#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.annotations import annotate_pdf
from app.models import TakeoffDocument


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(8 * 1024**2):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create an annotated PDF from takeoff.json geometry."
    )
    parser.add_argument("--pdf", type=Path, required=True)
    parser.add_argument("--takeoff-json", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--audit-output", type=Path)
    args = parser.parse_args()

    source = args.pdf.resolve()
    takeoff = TakeoffDocument.model_validate_json(
        args.takeoff_json.read_text(encoding="utf-8")
    )
    actual_hash = sha256_file(source)
    if actual_hash != takeoff.source.sha256:
        raise SystemExit(
            "The PDF SHA-256 does not match takeoff.json; refusing to annotate."
        )
    summary = annotate_pdf(source, args.output.resolve(), takeoff.assets)
    audit = (
        args.audit_output.resolve()
        if args.audit_output
        else args.output.with_suffix(".audit.json").resolve()
    )
    audit.write_text(
        summary.model_dump_json(indent=2) + "\n", encoding="utf-8"
    )
    print(summary.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
