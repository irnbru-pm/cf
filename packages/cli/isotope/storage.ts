// One framed, private socket inherited from the signed parent. No credential files.
import { readSync, writeSync } from "node:fs";

function transfer(buffer: Buffer, write: boolean) {
	for (let offset = 0; offset < buffer.length;) {
		const count = write
			? writeSync(3, buffer, offset, buffer.length - offset)
			: readSync(3, buffer, offset, buffer.length - offset, null);
		if (count <= 0) throw new Error("IrnBru credential service disconnected");
		offset += count;
	}
}
function request(payload: object) {
	const bytes = Buffer.from(JSON.stringify(payload));
	const header = Buffer.alloc(4);
	if (bytes.length > 256 * 1024)
		throw new Error("Oversized credential request");
	header.writeUInt32BE(bytes.length);
	transfer(header, true);
	transfer(bytes, true);
	transfer(header, false);
	const length = header.readUInt32BE();
	if (!length || length > 256 * 1024) throw new Error("Invalid IrnBru reply");
	const reply = Buffer.alloc(length);
	transfer(reply, false);
	const result = JSON.parse(reply.toString());
	if (result.ok !== true)
		throw new Error(result.error ?? "IrnBru denied credential access");
	return result.value ?? null;
}
export const context = {
	profile: "default",
	account: "",
	zone: "",
	operation: "",
};
const originals = new Map<string, string | null>();
export function storageFactory(profile = "default") {
	if (profile !== context.profile)
		throw new Error("Profile changed during command");
	function read() {
		if (!originals.has(profile))
			originals.set(profile, request({ ...context, op: "use" }));
		const value = originals.get(profile);
		return value ? JSON.parse(value) : undefined;
	}
	function change(value: string | null) {
		read();
		request({
			...context,
			op: value === null ? "delete" : "save",
			value,
			expected: originals.get(profile),
		});
		originals.set(profile, value);
	}
	return {
		read,
		write: (config: object) => change(JSON.stringify(config)),
		clear: () => {
			change(null);
			return true;
		},
		path: () => "IrnBru Keychain",
	};
}
