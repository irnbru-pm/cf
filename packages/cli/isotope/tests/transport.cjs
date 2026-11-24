// Loaded only by the fixture runner. The release launcher accepts no preloads.
const assert = require("node:assert/strict");
globalThis.fetch = async (input, init) => {
	const url = new URL(input instanceof Request ? input.url : String(input));
	assert.equal(init.redirect, "error");
	if (url.href === "https://api.cloudflare.com/client/v4/zones") {
		assert.equal(
			new Headers(init.headers).get("authorization"),
			"Bearer fixture-access"
		);
		return Response.json({
			success: true,
			result: [{ name: "fixture.example" }],
		});
	}
	assert.equal(url.origin, "https://dash.cloudflare.com");
	switch (url.pathname) {
		case "/oauth2/device/auth":
			return Response.json({
				device_code: "device",
				user_code: "CODE",
				verification_uri: "https://dash.cloudflare.com/verify",
				expires_in: 10,
			});
		case "/oauth2/token":
			return Response.json({
				access_token: "fixture-access",
				refresh_token: "fixture-refresh",
				expires_in: 3600,
				scope: "zone:read",
				token_type: "bearer",
			});
		case "/oauth2/revoke":
			assert.match(String(init.body), /fixture-refresh/);
			return new Response("");
		default:
			throw new Error("Unexpected fixture destination");
	}
};
