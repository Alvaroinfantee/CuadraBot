#!/usr/bin/env python3
"""Validate structure and evidence coverage in a prepared drawing index."""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path


def scalar(connection: sqlite3.Connection, query: str) -> int:
    return int(connection.execute(query).fetchone()[0])


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate a building drawing index")
    parser.add_argument("index", type=Path, help="Directory containing drawings.db")
    args = parser.parse_args()
    index_dir = args.index.resolve()
    db_path = index_dir / "drawings.db"
    required = [
        db_path,
        index_dir / "DRAWINGS.md",
        index_dir / "manifest.json",
        index_dir / "wiki" / "index.md",
    ]
    errors = [f"Missing required file: {path}" for path in required if not path.exists()]
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 2

    try:
        manifest = json.loads((index_dir / "manifest.json").read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"Invalid manifest.json: {exc}", file=sys.stderr)
        return 2

    connection = sqlite3.connect(db_path)
    connection.execute("PRAGMA foreign_keys = ON")
    integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
    foreign_key_errors = connection.execute("PRAGMA foreign_key_check").fetchall()
    if integrity != "ok":
        errors.append(f"SQLite integrity check failed: {integrity}")
    if foreign_key_errors:
        errors.append(f"Foreign-key violations: {len(foreign_key_errors)}")

    source_count = scalar(connection, "SELECT COUNT(*) FROM source_files")
    sheet_count = scalar(connection, "SELECT COUNT(*) FROM sheets")
    pending = scalar(connection, "SELECT COUNT(*) FROM sheets WHERE review_status='pending'")
    text_only = scalar(
        connection, "SELECT COUNT(*) FROM sheets WHERE review_status='text-reviewed'"
    )
    visually_reviewed = scalar(
        connection, "SELECT COUNT(*) FROM sheets WHERE review_status='visually-reviewed'"
    )
    image_only = scalar(
        connection, "SELECT COUNT(*) FROM sheets WHERE extraction_mode='image-only'"
    )
    unknown_revision = scalar(
        connection,
        """
        SELECT COUNT(*) FROM sheets
        WHERE COALESCE(TRIM(revision), '') = ''
          AND COALESCE(TRIM(issue_status), '') = ''
        """,
    )
    object_count = scalar(connection, "SELECT COUNT(*) FROM objects")
    fact_count = scalar(connection, "SELECT COUNT(*) FROM facts")
    evidence_count = scalar(connection, "SELECT COUNT(*) FROM evidence")
    low_facts = scalar(connection, "SELECT COUNT(*) FROM facts WHERE confidence='low'")
    unverified_facts = scalar(
        connection,
        """
        SELECT COUNT(*)
        FROM facts f
        JOIN evidence e ON e.id=f.evidence_id
        WHERE e.visual_checked=0
        """,
    )
    open_refs = scalar(
        connection, "SELECT COUNT(*) FROM unresolved_references WHERE status='open'"
    )
    open_conflicts = scalar(
        connection, "SELECT COUNT(*) FROM conflicts WHERE status='open'"
    )
    connection.close()

    manifest_pages = len(manifest.get("pages", []))
    if manifest_pages != sheet_count:
        errors.append(
            f"Manifest/database page mismatch: manifest={manifest_pages}, database={sheet_count}"
        )
    missing_page_assets = 0
    for page in manifest.get("pages", []):
        for field in ("text_path", "words_path"):
            value = page.get(field)
            if not value or not (index_dir / value).exists():
                missing_page_assets += 1
        image_value = page.get("image_path")
        if image_value and not (index_dir / image_value).exists():
            missing_page_assets += 1
    if missing_page_assets:
        errors.append(f"Missing generated page assets: {missing_page_assets}")

    print("Drawing index validation")
    print(f"  Sources: {source_count}")
    print(f"  Sheets/pages: {sheet_count}")
    print(
        "  Review status: "
        f"{visually_reviewed} visual, {text_only} text-only, {pending} pending"
    )
    print(f"  Image-only pages: {image_only}")
    print(f"  Unknown revision/status: {unknown_revision}")
    print(f"  Objects / facts / evidence: {object_count} / {fact_count} / {evidence_count}")
    print(f"  Low-confidence facts: {low_facts}")
    print(f"  Facts without visual verification: {unverified_facts}")
    print(f"  Open references / conflicts: {open_refs} / {open_conflicts}")

    warnings = []
    generation_warnings = manifest.get("errors", [])
    if generation_warnings:
        warnings.append(
            f"{len(generation_warnings)} preprocessing warning(s) are recorded "
            "in manifest.json"
        )
    if pending:
        warnings.append(f"{pending} page(s) remain pending review")
    if image_only:
        warnings.append(f"{image_only} image-only page(s) require visual review/OCR")
    if unknown_revision:
        warnings.append(f"{unknown_revision} page(s) have unknown revision/status")
    if unverified_facts:
        warnings.append(f"{unverified_facts} fact(s) lack visually checked evidence")
    if open_refs:
        warnings.append(f"{open_refs} unresolved reference(s) remain open")
    if open_conflicts:
        warnings.append(f"{open_conflicts} conflict(s) remain open")
    for warning in warnings:
        print(f"WARNING: {warning}", file=sys.stderr)
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    return 2 if errors else (1 if warnings else 0)


if __name__ == "__main__":
    raise SystemExit(main())
