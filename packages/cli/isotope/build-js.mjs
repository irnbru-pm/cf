import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
const here = path.dirname(fileURLToPath(import.meta.url));
const generated = path.resolve(here, "../src/commands/_generated");
const { commands } = JSON.parse(
	readFileSync(path.join(generated, "_meta/commands.json"))
);
const entries = [];
for (const cmd of commands) {
	if (
		!cmd.operationId ||
		!cmd.fullPath.every((word) => /^[a-z0-9-]+$/.test(word))
	) {
		continue;
	}
	const file = path.join(generated, ...cmd.fullPath) + ".ts";
	let src;
	try {
		src = readFileSync(file, "utf8");
	} catch {
		continue;
	}
	// Only generated typed Client.send handlers. Raw downloads, subprocesses and
	// hand-written project workflows require separate transport review.
	if (
		!src.includes("import operation from") ||
		!src.includes("client.send(") ||
		/requestApi|fetchRawBytes|#commands\/|import\(/.test(src)
	) {
		continue;
	}
	entries.push(
		JSON.stringify(cmd.fullPath.join(" ")) +
			":require(" +
			JSON.stringify(file) +
			").default"
	);
}
if (entries.length < 2000) {
	throw new Error("Unexpected upstream command inventory");
}
console.log("Bundling", entries.length, "upstream API handlers");
await build({
	entryPoints: [path.join(here, "main.ts")],
	outfile: process.argv[2],
	bundle: true,
	platform: "node",
	target: "node24",
	format: "cjs",
	define: { "import.meta.url": "__moduleURL" },
	banner: {
		js: 'const __moduleURL=require("node:url").pathToFileURL(__filename).href;',
	},
	plugins: [
		{
			name: "isotope",
			setup(b) {
				b.onResolve({ filter: /^undici$/ }, (args) => {
					if (args.importer.includes("/@cloudflare/workers-auth/")) {
						return { path: path.join(here, "oauth-transport.ts") };
					}
				});
				b.onResolve({ filter: /^irnbru:commands$/ }, (args) => ({
					path: args.path,
					namespace: "registry",
				}));
				b.onLoad({ filter: /.*/, namespace: "registry" }, () => ({
					contents: "export default {" + entries.join(",") + "}",
					resolveDir: here,
				}));
				b.onResolve({ filter: /^#lib\/auth\.js$/ }, () => ({
					path: path.join(here, "auth.ts"),
				}));
				b.onResolve(
					{ filter: /^#lib\/(local|telemetry\/index)\.js$/ },
					(args) => ({ path: args.path, namespace: "offline" })
				);
				b.onLoad({ filter: /.*/, namespace: "offline" }, () => ({
					contents:
						'export const LOCAL_ACCOUNT_ID="";export const runWithTelemetry=(_meta,_argv,run)=>run();',
				}));
			},
		},
	],
});
