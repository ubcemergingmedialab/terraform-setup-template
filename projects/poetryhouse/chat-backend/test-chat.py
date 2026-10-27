#!/usr/bin/env python3
"""
Smoke test for the PoetryHouse chat backend (NONE-auth Function URL + shared secret).

Reads the endpoint URL and shared secret from Terraform outputs, then verifies:
  1. correct secret            -> HTTP 200 with a {"text": ...} reply
  2. missing secret            -> HTTP 403 handler error
  3. wrong secret              -> HTTP 403 handler error

Run from this directory (after `terraform apply`):
    python test-chat.py

Requires: an initialized Terraform working dir (so `terraform output` works) and
network access to the Function URL. No AWS credentials needed (auth is the shared
secret, not IAM).
"""

import io
import json
import subprocess
import sys
import urllib.error
import urllib.request

# Force UTF-8 so emoji in model replies don't crash the Windows console.
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")


def tf_output(name: str) -> str:
    result = subprocess.run(
        ["terraform", "output", "-raw", name],
        capture_output=True, text=True, cwd=".",
    )
    if result.returncode != 0:
        sys.exit(f"terraform output -raw {name} failed:\n{result.stderr}")
    return result.stdout.strip()


def call(url: str, desc: str, headers: dict) -> tuple[int, str]:
    body = json.dumps({
        "systemPrompt": "You are a helpful assistant.",
        "messages": [{"role": "user", "text": "Say hello in one short sentence."}],
        "maxTokens": 64,
        "temperature": 0.7,
    })
    req = urllib.request.Request(
        url,
        data=body.encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        return resp.getcode(), resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except urllib.error.URLError as e:
        return 0, f"request failed: {e.reason}"


def main() -> None:
    url = tf_output("chat_function_url")
    secret = tf_output("chat_shared_secret")
    print(f"Endpoint: {url}")
    print(f"Secret length: {len(secret)}\n")

    checks = [
        ("correct secret", {"x-chat-secret": secret}, 200),
        ("missing secret", {}, 403),
        ("wrong secret", {"x-chat-secret": "not-the-secret"}, 403),
    ]

    all_ok = True
    for desc, headers, expected in checks:
        code, out = call(url, desc, headers)
        ok = code == expected
        all_ok = all_ok and ok
        status = "PASS" if ok else "FAIL"
        print(f"[{status}] {desc}: HTTP {code} (expected {expected})")
        print(f"        {out}\n")

    print("All checks passed." if all_ok else "One or more checks FAILED.")
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
