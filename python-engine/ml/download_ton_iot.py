"""Download the 211K-row processed TON_IoT network CSV mirror for local academic use.

Run from python-engine: python -m ml.download_ton_iot
The official UNSW dataset source and citation/usage terms are documented in README.md.
"""
from __future__ import annotations
import argparse
import hashlib
import sys
import urllib.request
from pathlib import Path

URL = "https://huggingface.co/datasets/codymlewis/TON_IoT_network/resolve/main/train_test_network.csv"
DEFAULT_DESTINATION = Path(__file__).resolve().parents[1] / "datasets" / "ton_iot" / "train_test_network.csv"


def main() -> int:
    parser = argparse.ArgumentParser(description="Download the processed TON_IoT network CSV for local academic experimentation.")
    parser.add_argument("--output", default=str(DEFAULT_DESTINATION), help="Output CSV path")
    args = parser.parse_args()
    destination = Path(args.output).expanduser().resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    temp = destination.with_suffix(destination.suffix + ".part")
    request = urllib.request.Request(URL, headers={"User-Agent": "SafeCut-Research-Project/1.0"})
    digest = hashlib.sha256()
    total = 0
    try:
        print(f"Downloading TON_IoT network CSV to {destination}")
        with urllib.request.urlopen(request, timeout=60) as response, temp.open("wb") as output:
            while True:
                block = response.read(1024 * 1024)
                if not block:
                    break
                output.write(block)
                digest.update(block)
                total += len(block)
        if total < 1_000_000:
            raise RuntimeError(f"Downloaded file is unexpectedly small ({total:,} bytes); check the source response.")
        # Catch an HTML error/login page before saving it as a CSV dataset.
        with temp.open("rb") as check:
            header = check.readline(16_384).decode("utf-8-sig", errors="replace").lower()
        if "label" not in header or "," not in header:
            raise RuntimeError("The downloaded file does not look like the expected TON_IoT network CSV.")
        temp.replace(destination)
        print(f"Downloaded {total:,} bytes; SHA-256: {digest.hexdigest()}")
        print("Verify academic-use and citation requirements from https://research.unsw.edu.au/projects/toniot-datasets")
        print("Next: py -m ml.train --dataset ton_iot --data \"datasets/ton_iot/train_test_network.csv\" --target-col label")
        return 0
    except Exception as exc:
        try:
            temp.unlink(missing_ok=True)
        except OSError:
            pass
        print(f"Download failed: {exc}", file=sys.stderr)
        print(f"Download manually from the official source: https://research.unsw.edu.au/projects/toniot-datasets", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
