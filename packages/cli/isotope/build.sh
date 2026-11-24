#!/bin/bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
out="$PWD/.irnbru-release"
app="$out/Cf.app"
mkdir -p "$app/Contents/"{MacOS,Resources,Helpers}
node_version=24.22.0
archive="$out/node-v$node_version-darwin-arm64.tar.gz"
if [[ ! -f "$archive" ]]; then curl --fail --location "https://nodejs.org/dist/v$node_version/node-v$node_version-darwin-arm64.tar.gz" --output "$archive"; fi
echo "6a9724d9b50a5f22b4816cded441b5a8d9ddae546191a5e5b7efa5a5e2ee26d5  $archive" | shasum -a 256 -c -
tar -xOf "$archive" "node-v$node_version-darwin-arm64/bin/node" > "$app/Contents/Helpers/node"
chmod 755 "$app/Contents/Helpers/node"
tar -xOf "$archive" "node-v$node_version-darwin-arm64/LICENSE" > "$app/Contents/Resources/LICENSE-node"
cp LICENSE-APACHE LICENSE-MIT "$app/Contents/Resources/"
node packages/cli/isotope/build-js.mjs "$app/Contents/Resources/cf.cjs"
xcrun clang++ -std=c++17 -arch arm64 -mmacosx-version-min=27.0 -fobjc-arc -framework Security -framework Foundation packages/cli/isotope/launcher.mm -o "$app/Contents/MacOS/cf"
python3 - "$app" <<'PY'
import plistlib,sys
with open(sys.argv[1]+"/Contents/Info.plist","wb") as f:
    plistlib.dump(dict(CFBundleIdentifier="dev.mxcl.irnbru.cf",CFBundleName="Cf",CFBundleExecutable="cf",CFBundlePackageType="APPL",CFBundleVersion="1",CFBundleShortVersionString="1.0.0",LSMinimumSystemVersion="27.0"),f)
PY
identity='Developer ID Application: Max Howell (ZU76A67LGU)'
codesign -f -s "$identity" --timestamp --options runtime -i dev.mxcl.irnbru.cf.node "$app/Contents/Helpers/node"
codesign -f -s "$identity" --timestamp --options runtime "$app"
codesign --verify --strict --deep "$app"
COPYFILE_DISABLE=1 tar -czf "$out/cf-darwin-arm64.tar.gz" -C "$out" Cf.app
