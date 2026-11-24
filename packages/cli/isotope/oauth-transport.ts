export const Headers = globalThis.Headers;
const oauthPaths = new Set([
	"/oauth2/device/auth",
	"/oauth2/token",
	"/oauth2/revoke",
]);
export const fetch: typeof globalThis.fetch = (input, init) => {
	const url = new URL(input instanceof Request ? input.url : String(input));
	if (
		url.origin !== "https://dash.cloudflare.com" ||
		!oauthPaths.has(url.pathname)
	) {
		throw new Error("Invalid Cloudflare OAuth destination");
	}
	return globalThis.fetch(input, { ...init, redirect: "error" });
};
