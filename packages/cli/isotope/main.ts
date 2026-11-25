import commands from "irnbru:commands";
import yargs from "yargs/yargs";
import { flow, login } from "./auth.js";
import { context } from "./storage.js";

async function main(args: string[]) {
	if (args.length === 1 && args[0] === "--version") {
		console.log("1.0.0-rc.5-irnbru.1");
		return;
	}
	const names = Object.keys(commands);
	const path: string[] = [];
	while (
		args.length &&
		!args[0].startsWith("-") &&
		!Object.hasOwn(commands, path.join(" ")) &&
		path[0] !== "auth"
	) {
		path.push(args[0]);
		args.shift();
	}
	if (path[0] === "auth" && args.length) {
		path.push(args[0]);
		args.shift();
	}
	const name = path.join(" ");
	if (
		(!name || !Object.hasOwn(commands, name)) &&
		!["auth login", "auth logout", "auth create", "auth delete"].includes(name)
	) {
		const matches = names.filter((key) => !name || key.startsWith(name + " "));
		if (!matches.length || args.some((arg) => arg !== "--help")) {
			throw new Error("Unsupported managed cf command: " + name);
		}
		console.log(
			[
				"cf auth login|logout [--profile NAME]",
				"cf auth create|delete NAME",
				...matches.map((key) => "cf " + key),
			].join("\n")
		);
		return;
	}
	context.operation = name;
	let parser = yargs(args)
		.scriptName("cf " + name)
		.locale("en")
		.strict()
		.exitProcess(false)
		.parserConfiguration({
			"dot-notation": false,
			"parse-positional-numbers": false,
			"parse-numbers": false,
		})
		.option("profile", { type: "string", default: "default" })
		.option("account-id", { type: "string" })
		.option("zone", { type: "string", alias: "z" })
		.option("quiet", { type: "boolean" })
		.help();
	function select(argv: Record<string, unknown>) {
		const profile = argv.profileName ?? argv.profile;
		if (typeof profile !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(profile)) {
			throw new Error("Invalid profile");
		}
		context.profile = profile;
		for (const [field, value] of [
			["account", argv.accountId],
			["zone", argv.zoneId ?? argv.zone],
		] as const) {
			if (
				value !== undefined &&
				(typeof value !== "string" || !/^[a-f0-9]{32}$/i.test(value))
			) {
				throw new Error("Invalid " + field + " ID");
			}
			context[field] = value ?? "";
		}
		flow.setProfile(context.profile);
	}
	if (name.startsWith("auth ")) {
		const named = ["auth create", "auth delete"].includes(name);
		parser = parser.command(
			named ? "$0 <profileName>" : "$0",
			"",
			(y) => y,
			async (argv) => {
				select(argv);
				if (name === "auth login" || name === "auth create") {
					await login();
				} else {
					await flow.logout(context.profile);
				}
			}
		);
	} else {
		const command = commands[name];
		parser = parser.command({
			...command,
			command: command.command.replace(/^\S+/, "$0"),
			handler: async (argv) => {
				select(argv);
				await command.handler(argv);
			},
		});
	}
	await parser.parseAsync();
}
main(process.argv.slice(2)).catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
