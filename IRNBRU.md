# Cloudflare CLI for IrnBru

The `irnbru` branch starts at Cloudflare’s `cf@1.0.0-rc.4` tag. Its Apple Silicon macOS 27 release packages 2,733 generated Cloudflare API commands and the upstream device OAuth flow in a signed application bundle.

Run `cf --help` for the included commands. For example, `cf zones list --dry-run` previews the request without credentials. On a compatible managed installation, use `cf auth login --profile Work`, `cf zones list --profile Work`, and `cf auth logout --profile Work`. Login prints the Cloudflare verification link. Supply account and zone IDs explicitly. This release omits directory profile bindings, project builds, raw transfers, executable project configuration and external plugins.

## Credential boundary

The launcher verifies the signature on Cf.app, including its bundled Node and dispatcher. It starts the child with a fixed entry point, clean environment, empty working directory and Node filesystem permissions limited to the entry point. The private Node executable has the JIT entitlement for V8 and HTTPS. Only the native launcher is an XPC peer. The launcher contacts the signed IrnBru helper only from a root-owned managed generation under /opt/bru/pkg/cf. An extracted bundle can display help and run dry runs.

Cloudflare’s workers-auth library handles browser device authorization, refresh and revocation. Its storage interface sends use, save and delete operations over an inherited socket to the launcher. The helper must independently verify the installed caller and authorize the operation before returning a profile. Writes and deletions carry the exact previously read value for compare-and-swap. Each request carries the selected profile, API command and applicable account and zone. API and OAuth requests reject redirects. Signing identity, asset digest and helper compatibility are recorded per release.

## Build and validation

Install the locked dependencies with `pnpm install --frozen-lockfile`. On the signing Mac run the following from the checkout root.

```sh
bash packages/cli/isotope/build.sh
bash packages/cli/isotope/tests/package.sh
python3 packages/cli/isotope/tests/flows.py
```

The build verifies the pinned Node archive, signs the nested interpreter and outer bundle, and writes the release archive to .irnbru-release. Package tests verify the extracted signature, hostile working directory and environment, unavailable helper and modified dispatcher. The flow tests run the packaged dispatcher with fixture storage and HTTP responses. They exercise two profiles, refresh, revocation and denial without a Cloudflare account.
