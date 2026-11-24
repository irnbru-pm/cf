import { createOAuthFlow } from "@cloudflare/workers-auth";
import { CF_CLI } from "@cloudflare/workers-auth/cf";
import { Client } from "../src/api/index.js";
import { context, storageFactory } from "./storage.js";

const transport = globalThis.fetch;
const oauthPaths = new Set([
	"/oauth2/device/auth",
	"/oauth2/token",
	"/oauth2/revoke",
]);
// workers-auth uses global fetch for device authorization, refresh and revocation.
globalThis.fetch = (input, init) => {
	const url = new URL(input instanceof Request ? input.url : String(input));
	if (
		url.origin !== "https://dash.cloudflare.com" ||
		!oauthPaths.has(url.pathname)
	) {
		throw new Error("Invalid Cloudflare OAuth destination");
	}
	return transport(input, { ...init, redirect: "error" });
};
export const flow = createOAuthFlow({
	logger: {
		log: console.error,
		warn: console.error,
		info: console.error,
		error: console.error,
		debug() {},
	},
	isNonInteractiveOrCI: () => true,
	openInBrowser: async () => {
		throw new Error("Use the printed Cloudflare verification URL");
	},
	hasEnvCredentials: () => false,
	storageFactory,
	clientId: CF_CLI.clientId,
	consent: CF_CLI.consent,
	redirectUri: CF_CLI.redirectUri,
	cliDisplayName: "cf",
	deviceLoginCommand: "cf auth login",
	allowGlobalAuthKey: false,
	temporary: undefined,
});
export async function login() {
	const signedIn = await flow.login({
		device: true,
		browser: false,
		scopes: CF_CLI.getDefaultScopeKeys(),
		profile: context.profile,
	});
	if (!signedIn) throw new Error("Cloudflare login did not complete");
}
export const resolveAccountIdSilent = async () => context.account || undefined;
export async function getAccountId() {
	if (!context.account)
		throw new Error("Supply --account-id with the Cloudflare account ID");
	return context.account;
}
export async function getZoneId(argv: { zone?: string; zoneId?: string }) {
	const zone = argv.zoneId ?? argv.zone ?? context.zone;
	if (!/^[a-f0-9]{32}$/i.test(zone))
		throw new Error("Supply --zone with the Cloudflare zone ID");
	context.zone = zone;
	return zone;
}
export function getWorkerName(argv: { scriptName?: string }) {
	if (!argv.scriptName) throw new Error("Supply --worker explicitly");
	return argv.scriptName;
}
export async function createCommandClient() {
	return new Client({
		baseUrl: "https://api.cloudflare.com/client/v4",
		maxRetries: 0,
		auth: async () => {
			const token = await flow.getOAuthTokenFromLocalState();
			if (!token) throw new Error("Sign in using cf auth login");
			return { headers: { Authorization: "Bearer " + token } };
		},
		fetch: (input, init) => {
			const url = new URL(input instanceof Request ? input.url : String(input));
			if (
				url.origin !== "https://api.cloudflare.com" ||
				!url.pathname.startsWith("/client/v4/")
			)
				throw new Error("Invalid Cloudflare API destination");
			return transport(input, { ...init, redirect: "error" });
		},
	});
}
