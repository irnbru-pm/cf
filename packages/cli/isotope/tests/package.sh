#!/bin/bash
set -euo pipefail
root=$(git rev-parse --show-toplevel)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
tar -xzf "$root/.irnbru-release/cf-darwin-arm64.tar.gz" -C "$tmp"
app="$tmp/Cf.app"
cf="$app/Contents/MacOS/cf"
codesign --verify --deep --strict -R='anchor apple generic and identifier "dev.mxcl.irnbru.cf" and certificate leaf[subject.OU] = "ZU76A67LGU"' "$app"
mkdir -p "$tmp/project/node_modules/cf/bin"
cd "$tmp/project"
echo 'throw Error("project code ran")' | tee node_modules/cf/bin/cf cloudflare.config.ts preload.cjs >/dev/null
echo 'CLOUDFLARE_API_TOKEN=fixture' > .env
export NODE_OPTIONS="--require=$PWD/preload.cjs" CLOUDFLARE_API_TOKEN=fixture
[[ $("$cf" --version) == 1.0.0-rc.5-irnbru.1 ]]
"$cf" zones list --dry-run | grep -q 'api.cloudflare.com/client/v4/zones'
"$cf" zones delete --zone 0123456789abcdef0123456789abcdef --dry-run | grep -q DELETE
if "$cf" zones list >message 2>&1; then exit 1; fi
grep -q 'compatible IrnBru helper' message
if "$cf" auth login >message 2>&1; then exit 1; fi
grep -q 'compatible IrnBru helper' message
if "$cf" workers dev >message 2>&1; then exit 1; fi
if "$cf" zones list --profile ../escape --dry-run >message 2>&1; then exit 1; fi
echo ' ' >> "$app/Contents/Resources/cf.cjs"
if "$cf" --version >message 2>&1; then exit 1; fi
grep -q 'Invalid cf Isotope signature' message
echo 'PASS: archive, signer, read/write dry runs, hostile project, helper absence and tamper rejection'
