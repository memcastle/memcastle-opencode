#!/usr/bin/env python3
"""Exercise a built plugin archive against a Core with the plugin-install contract.

MEMCASTLE_BIN selects a released or locally built Core. Everything else lives in a
temporary XDG home; neither the user's palace nor their agent configuration is used.
"""

import gzip
import io
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tarfile
import tempfile
import time
import tomllib
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]


def request(base: str, route: str, *, method: str = "GET", data: bytes | None = None,
            headers: dict[str, str] | None = None):
    with urlopen(Request(base + route, data=data, method=method, headers=headers or {}), timeout=20) as response:
        return json.load(response)


def incompatible(archive: bytes) -> bytes:
    """Change only the parent Core bound to exercise the host's version gate."""
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as bundle:
        entries = [(info.name, bundle.extractfile(info).read()) for info in bundle if info.isfile()]
    output = io.BytesIO()
    with gzip.GzipFile(fileobj=output, mode="wb", filename="", mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode="w") as bundle:
            for name, data in entries:
                if name == "plugin.toml":
                    data = data.replace(b'memcastle = ">=0.4, <0.6"', b'memcastle = ">=99"', 1)
                info = tarfile.TarInfo(name)
                info.size = len(data)
                bundle.addfile(info, io.BytesIO(data))
    return output.getvalue()


def mined(binary: Path, palace: Path, env: dict[str, str], base: str) -> dict:
    command = subprocess.run([str(binary), "--json", "--palace", str(palace), "mine", "opencode"],
                             env=env, capture_output=True, text=True)
    assert command.returncode == 0, command.stderr
    submitted = json.loads(command.stdout)
    for _ in range(120):
        job = request(base, f"/api/jobs/{submitted['id']}")
        if job["status"] in ("completed", "failed", "cancelled"):
            assert job["status"] == "completed", job
            return job["result"]
        time.sleep(0.25)
    raise AssertionError("OpenCode mining job did not complete within 30 seconds")


def main() -> None:
    legacy = sys.argv[1:] == ["--legacy"]
    if sys.argv[1:] and not legacy:
        raise SystemExit("usage: scripts/smoke_install.py [--legacy]")
    binary = Path(os.environ["MEMCASTLE_BIN"]).resolve()
    manifest = tomllib.loads((ROOT / "plugin.toml").read_text())
    plugin = manifest["plugin"]["id"]
    archive = (ROOT / "dist" / f"{plugin}-{manifest['plugin']['version']}.tar.gz").read_bytes()
    with tempfile.TemporaryDirectory(prefix="memcastle-plugin-smoke-") as scratch:
        root = Path(scratch)
        env = {key: value for key, value in os.environ.items() if not key.startswith("MEMCASTLE_")}
        env.update({"HOME": scratch, "XDG_DATA_HOME": str(root / "data"),
                    "XDG_CONFIG_HOME": str(root / "config"), "XDG_STATE_HOME": str(root / "state")})
        # Current Core may ship a legacy OpenCode integration; the disposable assets root tests the plugin alone.
        (root / "assets").mkdir()
        env["MEMCASTLE_ASSETS_DIR"] = str(root / "assets")
        # The local installer asks the agent its version; the stand-in never loads user plugins.
        agent = root / "bin"
        agent.mkdir()
        stand_in = ROOT / "modules/opencode/fixtures/bin/opencode"
        (agent / "opencode").write_text(
            f"#!/bin/sh\nif [ \"$1\" = '--version' ]; then printf 'opencode 1.99.0\\n'; "
            f"else exec '{stand_in}' \"$@\"; fi\n"
        )
        (agent / "opencode").chmod(0o755)
        env["PATH"] = str(agent) + os.pathsep + os.environ["PATH"]
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            port = probe.getsockname()[1]
        base = f"http://127.0.0.1:{port}"
        process = subprocess.Popen([str(binary), "--palace", str(root / "palace"), "serve",
                                    "--bind", "127.0.0.1", "--port", str(port)],
                                   cwd=root, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        try:
            for _ in range(120):
                if process.poll() is not None:
                    raise RuntimeError(f"daemon exited during startup: {process.stderr.read().decode()}")
                try:
                    request(base, "/api/health")
                    break
                except (URLError, TimeoutError):
                    time.sleep(0.25)
            else:
                raise RuntimeError("temporary daemon did not become healthy within 30 seconds")
            preview = request(base, "/api/plugins/preview", method="POST", data=archive)
            assert preview["id"] == plugin
            expected = {item["id"] for item in manifest.get("modules", [])}
            assert {item["id"] for item in preview["modules"]} == expected
            assert not request(base, "/api/plugins")
            if legacy:
                source_archive = root / "legacy.tar.gz"
                for args in (
                    ["source", "package", "--no-build", "--output", str(source_archive),
                     str(ROOT / "modules/opencode")],
                    ["source", "install", str(source_archive), "--enable", "--consent",
                     preview["source_consents"][0]["digest"]],
                ):
                    command = subprocess.run([str(binary), "--palace", str(root / "palace"), *args],
                                             env=env, capture_output=True, text=True)
                    assert command.returncode == 0, command.stderr
                initial = mined(binary, root / "palace", env, base)
                assert initial["created"] == 3, initial
                miner = request(base, "/api/miners/history", method="PUT",
                                data=json.dumps({"source": "opencode", "options": {"since": "2026-07",
                                                                                "dir": "/home/me/notes"}}).encode(),
                                headers={"Content-Type": "application/json"})
                assert miner["miner"]["source"] == "opencode", miner
                for args in (["source", "disable", "opencode"], ["source", "remove", "opencode", "--yes"]):
                    command = subprocess.run([str(binary), "--palace", str(root / "palace"), *args],
                                             env=env, capture_output=True, text=True)
                    assert command.returncode == 0, command.stderr
                blocked = request(base, "/api/plugins/preview", method="POST", data=archive)
                assert blocked["adoptions"] == ["opencode"], blocked
            consents = {item["source"]: item["digest"] for item in preview["source_consents"]}
            installed = request(base, "/api/plugins", method="POST", data=archive,
                                headers={"X-MemCastle-Consents": json.dumps(consents),
                                         "X-MemCastle-Adopt-Sources": json.dumps(["opencode"] if legacy else [])})
            assert installed["id"] == plugin
            if legacy:
                miner = request(base, "/api/miners/history")
                assert miner["source"] == "opencode" and miner["options"] == {
                    "since": "2026-07", "dir": "/home/me/notes"}, miner
            assert request(base, f"/api/plugins/{plugin}")["id"] == plugin
            for item in manifest.get("modules", []):
                public_id = item.get("identity", item["id"])
                if item["type"] == "source":
                    source = request(base, f"/api/source-packages/{public_id}")
                    assert source["state"] == "installed", source
                    command = subprocess.run([str(binary), "--palace", str(root / "palace"),
                                               "source", "enable", public_id], env=env,
                                             capture_output=True, text=True)
                    assert command.returncode == 0, command.stderr
                elif item["type"] == "integration":
                    command = subprocess.run([str(binary), "--json", "integration", "install", public_id],
                                             env=env, capture_output=True, text=True)
                    assert command.returncode == 0, command.stderr
                    assert json.loads(command.stdout)["id"] == public_id
            first = mined(binary, root / "palace", env, base)
            assert (first["documents"] == 0 if legacy else first["created"] == 3), first
            hits = request(base, "/api/search?q=rotate%20signing%20keys")
            assert len(hits) == 1 and hits[0]["source"]["origin"]["source"] == "opencode", hits
            second = mined(binary, root / "palace", env, base)
            assert second["documents"] == 0, second
            assert len(request(base, "/api/search?q=rotate%20signing%20keys")) == 1
            if b'memcastle = ">=0.4, <0.6"' in archive:
                try:
                    request(base, "/api/plugins/preview", method="POST", data=incompatible(archive))
                except HTTPError as error:
                    assert error.code == 400, error.read()
                else:
                    raise AssertionError("an incompatible parent manifest was accepted")
        finally:
            process.terminate()
            try:
                process.communicate(timeout=20)
            except subprocess.TimeoutExpired:
                process.kill()
                process.communicate()
    print("OpenCode plugin preview, install, mining, provenance, incremental cursor and version gate passed")


if __name__ == "__main__":
    main()
