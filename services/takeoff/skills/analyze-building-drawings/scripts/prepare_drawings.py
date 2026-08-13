#!/usr/bin/env python3
"""Prepare PDF construction drawings for evidence-grounded indexing."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import shutil
import sqlite3
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree

try:
    import pdfplumber
except ImportError as exc:
    raise SystemExit(
        "pdfplumber is required. Use the bundled workspace Python or install pdfplumber."
    ) from exc

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError as exc:
    raise SystemExit(
        "Pillow is required. Use the bundled workspace Python or install Pillow."
    ) from exc


SHEET_PATTERNS = [
    re.compile(r"(?im)^\s*([A-Z]{1,3}[-.]?\d{2,4}(?:\.\d+)?)\s*$"),
    re.compile(r"(?im)\b(?:DRAWING|SHEET)\s*(?:NO\.?|NUMBER|#)?\s*[:\-]?\s*([A-Z]{1,3}[-.]?\d{2,4}(?:\.\d+)?)\b"),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Hash, render, and extract one PDF drawing set into a reusable index workspace."
        )
    )
    parser.add_argument("input", type=Path, help="PDF file or directory containing PDFs")
    parser.add_argument("--output", required=True, type=Path, help="Index output directory")
    parser.add_argument("--dpi", type=int, default=180, help="Render resolution (default: 180)")
    parser.add_argument(
        "--ocr",
        choices=("auto", "always", "never"),
        default="auto",
        help="Use tesseract OCR when available (default: auto for text-poor pages)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Rebuild generated files in an existing output directory",
    )
    return parser.parse_args()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_slug(value: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-._").lower()
    return slug or "drawing-set"


def collect_pdfs(input_path: Path) -> list[Path]:
    if input_path.is_file() and input_path.suffix.lower() == ".pdf":
        return [input_path.resolve()]
    if input_path.is_dir():
        return sorted(p.resolve() for p in input_path.rglob("*.pdf") if p.is_file())
    raise SystemExit(f"Input must be a PDF or a directory containing PDFs: {input_path}")


def infer_sheet_number(text: str) -> str | None:
    for pattern in SHEET_PATTERNS:
        match = pattern.search(text[:12000])
        if match:
            return match.group(1).upper()
    return None


def infer_title(text: str, sheet_number: str | None) -> str | None:
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    candidates = []
    for line in lines[:80]:
        if not (4 <= len(line) <= 100):
            continue
        if sheet_number and line.upper() == sheet_number.upper():
            continue
        if re.search(r"\b(scale|revision|rev|date|drawn|checked|project)\b", line, re.I):
            continue
        if sum(ch.isalpha() for ch in line) < 4:
            continue
        candidates.append(line)
    title_terms = re.compile(
        r"\b(plan|elevation|section|schedule|diagram|layout|legend|notes|details?|"
        r"floor|roof|foundation|site)\b",
        re.I,
    )
    for line in candidates:
        if title_terms.search(line) and not re.search(r"\b(refer|see)\b", line, re.I):
            return line
    return candidates[0] if candidates else None


def render_page(pdf_path: Path, page_number: int, output_png: Path, dpi: int) -> None:
    pdftoppm = shutil.which("pdftoppm")
    if not pdftoppm:
        raise RuntimeError("pdftoppm is required to render drawing pages")
    output_png.parent.mkdir(parents=True, exist_ok=True)
    prefix = output_png.with_suffix("")
    command = [
        pdftoppm,
        "-f",
        str(page_number),
        "-l",
        str(page_number),
        "-singlefile",
        "-r",
        str(dpi),
        "-png",
        "-cropbox",
        str(pdf_path),
        str(prefix),
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or "pdftoppm failed")


def _xml_local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _required_float(element: ElementTree.Element, attribute: str) -> float:
    value = element.get(attribute)
    if value is None:
        raise RuntimeError(f"pdftotext output is missing {attribute}")
    number = float(value)
    if not math.isfinite(number) or number < 0:
        raise RuntimeError(f"pdftotext output has invalid {attribute}")
    return number


def parse_poppler_bbox(xml_text: str) -> tuple[str, list[dict], float, float]:
    """Parse one `pdftotext -bbox-layout` page without loading PDF graphics."""
    try:
        root = ElementTree.fromstring(xml_text)
    except ElementTree.ParseError as exc:
        raise RuntimeError("pdftotext returned malformed bbox XML") from exc
    page = next(
        (element for element in root.iter() if _xml_local_name(element.tag) == "page"),
        None,
    )
    if page is None:
        raise RuntimeError("pdftotext bbox output has no page")
    page_width = _required_float(page, "width")
    page_height = _required_float(page, "height")
    if page_width == 0 or page_height == 0:
        raise RuntimeError("pdftotext returned invalid page dimensions")

    words: list[dict] = []
    text_lines: list[str] = []
    for line in (
        element for element in page.iter() if _xml_local_name(element.tag) == "line"
    ):
        line_text: list[str] = []
        for element in line.iter():
            if _xml_local_name(element.tag) != "word":
                continue
            text = "".join(element.itertext()).strip()
            if not text:
                continue
            x0 = _required_float(element, "xMin")
            x1 = _required_float(element, "xMax")
            top = _required_float(element, "yMin")
            bottom = _required_float(element, "yMax")
            if x1 < x0 or bottom < top:
                raise RuntimeError("pdftotext returned an inverted word bbox")
            words.append(
                {
                    "text": text,
                    "x0": x0,
                    "x1": x1,
                    "top": top,
                    "bottom": bottom,
                    "upright": True,
                    "height": bottom - top,
                    "width": x1 - x0,
                    "direction": "ltr",
                }
            )
            line_text.append(text)
        if line_text:
            text_lines.append(" ".join(line_text))
    return "\n".join(text_lines), words, page_width, page_height


def extract_positioned_text(
    pdf_path: Path, page_number: int
) -> tuple[str, list[dict], float, float]:
    pdftotext = shutil.which("pdftotext")
    if not pdftotext:
        raise RuntimeError("pdftotext is required to extract drawing text")
    result = subprocess.run(
        [
            pdftotext,
            "-f",
            str(page_number),
            "-l",
            str(page_number),
            "-bbox-layout",
            "-cropbox",
            str(pdf_path),
            "-",
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or "pdftotext failed")
    return parse_poppler_bbox(result.stdout)


def run_ocr(image_path: Path) -> str:
    tesseract = shutil.which("tesseract")
    if not tesseract:
        return ""
    result = subprocess.run(
        [tesseract, str(image_path), "stdout"],
        capture_output=True,
        text=True,
    )
    return result.stdout if result.returncode == 0 else ""


def make_contact_sheets(items: list[dict], output_dir: Path, per_sheet: int = 12) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    thumb_w, thumb_h, label_h = 520, 360, 34
    columns, rows = 3, 4
    font = ImageFont.load_default()
    for batch_start in range(0, len(items), per_sheet):
        batch = items[batch_start : batch_start + per_sheet]
        canvas = Image.new(
            "RGB",
            (columns * thumb_w, rows * (thumb_h + label_h)),
            "white",
        )
        draw = ImageDraw.Draw(canvas)
        for index, item in enumerate(batch):
            image_path = Path(item["image_path"])
            if not image_path.exists():
                continue
            with Image.open(image_path) as source:
                preview = source.convert("RGB")
                preview.thumbnail((thumb_w - 12, thumb_h - 12))
                x = (index % columns) * thumb_w + (thumb_w - preview.width) // 2
                y0 = (index // columns) * (thumb_h + label_h)
                y = y0 + (thumb_h - preview.height) // 2
                canvas.paste(preview, (x, y))
            label = (
                f"{item['filename']} p.{item['source_page']}"
                + (f" | {item['sheet_number']}" if item.get("sheet_number") else "")
            )
            draw.rectangle(
                (
                    (index % columns) * thumb_w,
                    y0 + thumb_h,
                    (index % columns + 1) * thumb_w,
                    y0 + thumb_h + label_h,
                ),
                fill="#eeeeee",
            )
            draw.text(
                ((index % columns) * thumb_w + 8, y0 + thumb_h + 9),
                label[:85],
                fill="black",
                font=font,
            )
        number = batch_start // per_sheet + 1
        canvas.save(output_dir / f"contact-{number:03d}.jpg", quality=86)


def write_drawings_md(output_dir: Path, source_rows: list[dict], page_rows: list[dict]) -> None:
    lines = [
        "# Drawing Set Index",
        "",
        "> Generated preprocessing register. Sheet metadata is provisional until visually checked.",
        "",
        "## Source files",
        "",
        "| File | Pages | SHA-256 | Issue/revision |",
        "|---|---:|---|---|",
    ]
    for row in source_rows:
        lines.append(
            f"| {row['filename']} | {row['page_count']} | `{row['sha256']}` | Unknown |"
        )
    lines.extend(
        [
            "",
            "## Project map",
            "",
            "- Project/status/revision: Unknown - confirm before relying on the index.",
            "- Disciplines: Pending classification.",
            "- Current versus superseded sheets: Pending review.",
            "- Open conflicts and missing references: Pending review.",
            "",
            "## Sheet register",
            "",
            "| Source | PDF page | Sheet | Provisional title | Text mode | Review |",
            "|---|---:|---|---|---|---|",
        ]
    )
    for row in page_rows:
        title = (row.get("title") or "").replace("|", "\\|")
        lines.append(
            f"| {row['filename']} | {row['source_page']} | "
            f"{row.get('sheet_number') or ''} | {title} | "
            f"{row['extraction_mode']} | pending |"
        )
    lines.extend(
        [
            "",
            "## Query routing",
            "",
            "- Object quantities and properties: query `drawings.db`.",
            "- Notes, schedules, and specifications: read `wiki/index.md` and its topic pages.",
            "- Ambiguous, visual, medium/low-confidence, or consequential answers: reopen the cited page image and source PDF.",
            "",
            "## Known limitations",
            "",
            "- No page is visually verified merely because it was rendered or text was extracted.",
            "- OCR and inferred sheet titles/numbers may be wrong.",
            "- This index is not an issued design document and does not authorize construction.",
            "",
        ]
    )
    (output_dir / "DRAWINGS.md").write_text("\n".join(lines), encoding="utf-8")


def prepare_output(
    output_dir: Path, force: bool, source_files: list[Path]
) -> None:
    if any(
        source == output_dir or source.is_relative_to(output_dir)
        for source in source_files
    ):
        raise SystemExit(
            "The output directory must not contain a source PDF; choose a "
            "separate index directory to keep source drawings immutable."
        )
    if output_dir.exists() and any(output_dir.iterdir()):
        if not force:
            raise SystemExit(
                f"Output directory is not empty: {output_dir}. "
                "Use --force to rebuild generated files."
            )
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    for child in ("pages", "contact-sheets", "wiki"):
        (output_dir / child).mkdir(parents=True, exist_ok=True)


def main() -> int:
    args = parse_args()
    pdfs = collect_pdfs(args.input)
    if not pdfs:
        raise SystemExit(f"No PDF files found under {args.input}")
    if not 72 <= args.dpi <= 600:
        raise SystemExit("--dpi must be between 72 and 600")

    output_dir = args.output.resolve()
    prepare_output(output_dir, args.force, pdfs)
    db_path = output_dir / "drawings.db"
    schema_path = Path(__file__).resolve().parent.parent / "references" / "schema.sql"
    connection = sqlite3.connect(db_path)
    connection.executescript(schema_path.read_text(encoding="utf-8"))

    now = datetime.now(timezone.utc).isoformat()
    source_rows: list[dict] = []
    page_rows: list[dict] = []
    errors: list[str] = []
    for pdf_path in pdfs:
        digest = sha256_file(pdf_path)
        with pdfplumber.open(pdf_path) as pdf:
            page_count = len(pdf.pages)
            cursor = connection.execute(
                """
                INSERT INTO source_files
                    (path, filename, sha256, page_count, ingested_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (str(pdf_path), pdf_path.name, digest, page_count, now),
            )
            source_file_id = cursor.lastrowid
            file_slug = (
                f"{safe_slug(pdf_path.stem)}-{digest[:10]}-"
                f"{source_file_id:04d}"
            )
            source_rows.append(
                {
                    "filename": pdf_path.name,
                    "path": str(pdf_path),
                    "sha256": digest,
                    "page_count": page_count,
                }
            )
            for page_index, page in enumerate(pdf.pages, start=1):
                page_base = output_dir / "pages" / file_slug / f"page-{page_index:04d}"
                image_path = page_base.with_suffix(".png")
                text_path = page_base.with_suffix(".txt")
                words_path = page_base.with_suffix(".words.json")
                page_base.parent.mkdir(parents=True, exist_ok=True)

                try:
                    render_page(pdf_path, page_index, image_path, args.dpi)
                except Exception as exc:
                    errors.append(f"{pdf_path.name} p.{page_index}: render failed: {exc}")

                # pdftoppm and pdftotext both use the visible CropBox.  Keep
                # vector-heavy CAD content out of pdfplumber's object parser:
                # Poppler extracts one page at a time in a bounded child
                # process and reports displayed-page top-left coordinates.
                visible_page = page.crop(page.cropbox, strict=False)
                try:
                    (
                        vector_text,
                        words,
                        page_width_points,
                        page_height_points,
                    ) = extract_positioned_text(
                        pdf_path,
                        page_index,
                    )
                except Exception as exc:
                    vector_text = ""
                    words = []
                    page_width_points = float(visible_page.width)
                    page_height_points = float(visible_page.height)
                    errors.append(f"{pdf_path.name} p.{page_index}: text extraction failed: {exc}")
                words_payload = {
                    "source_pdf": str(pdf_path),
                    "source_page": page_index,
                    "page_width_points": page_width_points,
                    "page_height_points": page_height_points,
                    "coordinate_space": "pdf_display_points_top_left",
                    "words": words,
                }
                words_path.write_text(
                    json.dumps(words_payload, indent=2, ensure_ascii=False),
                    encoding="utf-8",
                )

                ocr_text = ""
                should_ocr = args.ocr == "always" or (
                    args.ocr == "auto" and len(vector_text.strip()) < 80
                )
                if should_ocr and image_path.exists():
                    ocr_text = run_ocr(image_path)
                if vector_text.strip() and ocr_text.strip():
                    extraction_mode = "mixed"
                    final_text = (
                        "[SELECTABLE TEXT]\n"
                        + vector_text
                        + "\n\n[OCR TEXT]\n"
                        + ocr_text
                    )
                elif vector_text.strip():
                    extraction_mode = "vector-text"
                    final_text = vector_text
                elif ocr_text.strip():
                    extraction_mode = "ocr"
                    final_text = ocr_text
                else:
                    extraction_mode = "image-only"
                    final_text = ""
                text_path.write_text(final_text, encoding="utf-8")

                sheet_number = infer_sheet_number(final_text)
                title = infer_title(final_text, sheet_number)
                relative_image = (
                    str(image_path.relative_to(output_dir)) if image_path.exists() else None
                )
                relative_text = str(text_path.relative_to(output_dir))
                relative_words = str(words_path.relative_to(output_dir))
                connection.execute(
                    """
                    INSERT INTO sheets (
                        source_file_id, source_page, sheet_number, title,
                        image_path, text_path, words_path, extraction_mode
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        source_file_id,
                        page_index,
                        sheet_number,
                        title,
                        relative_image,
                        relative_text,
                        relative_words,
                        extraction_mode,
                    ),
                )
                page_rows.append(
                    {
                        "filename": pdf_path.name,
                        "source_page": page_index,
                        "sheet_number": sheet_number,
                        "title": title,
                        "image_path": str(image_path),
                        "text_path": relative_text,
                        "words_path": relative_words,
                        "extraction_mode": extraction_mode,
                    }
                )
        connection.commit()

    connection.executemany(
        "INSERT OR REPLACE INTO metadata(key, value) VALUES (?, ?)",
        [
            ("schema_version", "1"),
            ("created_at", now),
            ("output_directory", str(output_dir)),
            ("source_count", str(len(source_rows))),
            ("page_count", str(len(page_rows))),
        ],
    )
    connection.commit()
    connection.close()

    make_contact_sheets(page_rows, output_dir / "contact-sheets")
    write_drawings_md(output_dir, source_rows, page_rows)
    (output_dir / "wiki" / "index.md").write_text(
        "# Drawing Topics\n\n"
        "> Populate topic pages from visually verified notes, schedules, and specifications.\n\n"
        "- Project controls: pending\n"
        "- Disciplines and systems: pending classification\n"
        "- Conflicts and unresolved references: see `drawings.db`\n",
        encoding="utf-8",
    )
    manifest = {
        "created_at": now,
        "output_directory": str(output_dir),
        "sources": source_rows,
        "pages": [
            {key: value for key, value in row.items() if key != "image_path"}
            | {
                "image_path": (
                    str(Path(row["image_path"]).relative_to(output_dir))
                    if Path(row["image_path"]).exists()
                    else None
                )
            }
            for row in page_rows
        ],
        "errors": errors,
    }
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"Prepared {len(source_rows)} PDF(s), {len(page_rows)} page(s)")
    print(f"Index: {output_dir}")
    if errors:
        print(f"Warnings: {len(errors)} (see manifest.json)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
