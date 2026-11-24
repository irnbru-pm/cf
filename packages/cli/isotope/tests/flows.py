"""Exercise the bundled dispatcher against synthetic storage and HTTPS responses."""
import json
from pathlib import Path
import socket
import struct
import subprocess
import sys

root = Path(__file__).resolve().parents[4]
contents = root / ".irnbru-release/Cf.app/Contents"
node = contents / "Helpers/node"
script = contents / "Resources/cf.cjs"
transport = Path(__file__).with_name("transport.cjs")
profiles = {}


def run(args, profile, operation, permitted=True):
    parent, child = socket.socketpair()
    cmd = [node, "--require", transport, script, *args]
    bootstrap = "import os,sys;os.dup2(int(sys.argv[1]),3,inheritable=True);os.execv(sys.argv[2],sys.argv[2:])"
    with parent, child, subprocess.Popen(
        [sys.executable, "-c", bootstrap, str(child.fileno()), *cmd],
        pass_fds=[child.fileno()], env={"HOME":"/var/empty"}, stdout=subprocess.PIPE, stderr=subprocess.PIPE
    ) as proc:
        child.close()
        parent.settimeout(12)
        ops = []
        with parent.makefile("rb") as stream:
            while header := stream.read(4):
                size, = struct.unpack(">I", header)
                assert 0 < size <= 262144
                req = json.loads(stream.read(size))
                assert (req["profile"], req["operation"]) == (profile, operation), req.keys()
                ops.append(req["op"])
                reply = {"ok": permitted}
                if permitted:
                    if req["op"] == "use":
                        reply["value"] = profiles.get(profile)
                    else:
                        assert req["expected"] == profiles.get(profile)
                        if req["op"] == "save":
                            profiles[profile] = req["value"]
                        else:
                            assert req["op"] == "delete"
                            profiles.pop(profile)
                data = json.dumps(reply).encode()
                parent.sendall(struct.pack(">I",len(data)) + data)
        out, err = proc.communicate(timeout=12)
        assert (proc.returncode == 0) == permitted, (out, err)
        assert b"fixture-access" not in out+err and b"fixture-refresh" not in out+err
        return ops, out


for name in ("default", "Work"):
    assert run(["auth","login","--profile",name], name,"auth login")[0] == ["use","save"]
ops, output = run(["zones","list","--profile","Work"],"Work","zones list")
assert ops == ["use"] and b"fixture.example" in output
value = json.loads(profiles["Work"])
value["expiration_time"] = "2000-01-01T00:00:00Z"
profiles["Work"] = json.dumps(value)
assert run(["zones","list","--profile","Work"],"Work","zones list")[0] == ["use","save"]
assert run(["zones","list"],"default","zones list",False)[0] == ["use"]
assert run(["auth","delete","Work"],"Work","auth delete")[0] == ["use","delete"]
assert set(profiles) == {"default"}
print("PASS: device login, profile selection, API read, refresh, denial and logout")
