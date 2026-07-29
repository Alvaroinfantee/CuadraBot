from __future__ import annotations

import hashlib
from collections import Counter
from pathlib import Path
from typing import Iterable

from pypdf import PdfReader, PdfWriter
from pypdf.annotations import FreeText, Rectangle, Text
from pypdf.generic import (
    ArrayObject,
    DictionaryObject,
    FloatObject,
    NameObject,
    NumberObject,
    TextStringObject,
)

from .models import AnnotationSummary, BoundingBox, TakeoffAsset


PALETTE = (
    "D73027",
    "4575B4",
    "1A9850",
    "984EA3",
    "FF7F00",
    "00A6A6",
    "A65628",
    "E7298A",
    "4D4D4D",
    "66A61E",
)


def _hex_to_pdf_color(value: str) -> ArrayObject:
    cleaned = value.lstrip("#")
    return ArrayObject(
        [
            FloatObject(int(cleaned[index : index + 2], 16) / 255)
            for index in (0, 2, 4)
        ]
    )


def color_for_code(code: str) -> str:
    digest = hashlib.sha256(code.encode("utf-8")).digest()
    return PALETTE[int.from_bytes(digest[:2], "big") % len(PALETTE)]


def displayed_size(page: object) -> tuple[float, float]:
    width = float(page.mediabox.width)
    height = float(page.mediabox.height)
    rotation = int(page.rotation or 0) % 360
    return (height, width) if rotation in {90, 270} else (width, height)


def display_top_left_to_pdf(
    page: object, x: float, y: float
) -> tuple[float, float]:
    """Map displayed-page top-left points to unrotated PDF coordinates."""
    width = float(page.mediabox.width)
    height = float(page.mediabox.height)
    rotation = int(page.rotation or 0) % 360
    if rotation == 0:
        return x, height - y
    if rotation == 90:
        return y, x
    if rotation == 180:
        return width - x, y
    if rotation == 270:
        return width - y, height - x
    raise ValueError(f"Unsupported page rotation {rotation}")


def _asset_display_box(
    asset: TakeoffAsset, radius: float
) -> BoundingBox:
    if asset.bbox is not None:
        return asset.bbox
    center = asset.center()
    return BoundingBox(
        x0=center.x - radius,
        y0=center.y - radius,
        x1=center.x + radius,
        y1=center.y + radius,
    )


def _pdf_rect(
    page: object, display_box: BoundingBox
) -> tuple[float, float, float, float]:
    points = [
        display_top_left_to_pdf(page, display_box.x0, display_box.y0),
        display_top_left_to_pdf(page, display_box.x1, display_box.y0),
        display_top_left_to_pdf(page, display_box.x0, display_box.y1),
        display_top_left_to_pdf(page, display_box.x1, display_box.y1),
    ]
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return min(xs), min(ys), max(xs), max(ys)


def _annotation_contents(asset: TakeoffAsset) -> str:
    parts = [
        f"ID: {asset.unit_id}",
        f"Code: {asset.code}",
        f"Item: {asset.description}",
        f"Sheet: {asset.sheet}",
        f"PDF page: {asset.page}",
        f"Area: {asset.area_code} - {asset.area}",
        f"Level: {asset.level}",
        f"Method: {asset.method}",
        f"Confidence: {asset.confidence}",
    ]
    if asset.visible_label:
        parts.append(f"Visible label: {asset.visible_label}")
    if asset.notes:
        parts.append(f"Validation note: {asset.notes}")
    return "\n".join(parts)


def _style_rectangle(
    annotation: Rectangle, asset: TakeoffAsset, color: str
) -> Rectangle:
    annotation[NameObject("/Contents")] = TextStringObject(
        _annotation_contents(asset)
    )
    annotation[NameObject("/C")] = _hex_to_pdf_color(color)
    annotation[NameObject("/CA")] = FloatObject(0.88)
    annotation[NameObject("/NM")] = TextStringObject(asset.unit_id)
    annotation[NameObject("/F")] = NumberObject(4)
    annotation[NameObject("/BS")] = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Border"),
            NameObject("/W"): FloatObject(1.6),
            NameObject("/S"): NameObject("/S"),
        }
    )
    return annotation


def annotate_pdf(
    source_pdf: Path,
    output_pdf: Path,
    assets: Iterable[TakeoffAsset],
    *,
    marker_radius: float = 7.0,
    add_page_notes: bool = True,
    sample_watermark: bool = False,
) -> AnnotationSummary:
    source_pdf = source_pdf.resolve()
    output_pdf = output_pdf.resolve()
    output_pdf.parent.mkdir(parents=True, exist_ok=True)
    asset_list = list(assets)

    reader = PdfReader(str(source_pdf), strict=False)
    page_count = len(reader.pages)
    by_page: dict[int, list[TakeoffAsset]] = {}
    skipped = 0
    for asset in asset_list:
        if not 1 <= asset.page <= page_count:
            skipped += 1
            continue
        by_page.setdefault(asset.page, []).append(asset)

    writer = PdfWriter(str(source_pdf), incremental=True, strict=False)
    annotated = 0
    for page_number in range(1, page_count + 1):
        page_assets = by_page.get(page_number, [])
        page = reader.pages[page_number - 1]
        display_width, display_height = displayed_size(page)
        page_counts = Counter(asset.code for asset in page_assets)
        if sample_watermark:
            banner_height = min(48.0, max(24.0, display_height * 0.08))
            top = max(12.0, (display_height - banner_height) / 2)
            banner = FreeText(
                text="CUADRABOT SAMPLE",
                rect=_pdf_rect(
                    page,
                    BoundingBox(
                        x0=max(12.0, display_width * 0.15),
                        y0=top,
                        x1=min(display_width - 12.0, display_width * 0.85),
                        y1=min(display_height - 12.0, top + banner_height),
                    ),
                ),
                font="Helvetica",
                bold=True,
                font_size="28pt",
                font_color="B42318",
                border_color="B42318",
                background_color="FFF4E8",
            )
            banner[NameObject("/F")] = NumberObject(196)
            banner[NameObject("/CA")] = FloatObject(0.72)
            writer.add_annotation(page_number - 1, banner)
        if add_page_notes:
            note_rect = _pdf_rect(
                page,
                BoundingBox(
                    x0=12,
                    y0=12,
                    x1=min(42, display_width - 1),
                    y1=min(42, display_height - 1),
                ),
            )
            note_text = "\n".join(
                [
                    f"Takeoff annotation audit - PDF page {page_number}",
                    f"Markers: {len(page_assets)}",
                    *[
                        f"{code}: {count}"
                        for code, count in sorted(page_counts.items())
                    ],
                ]
            )
            note = Text(rect=note_rect, text=note_text, open=False)
            note[NameObject("/T")] = TextStringObject("Takeoff page summary")
            note[NameObject("/F")] = NumberObject(4)
            writer.add_annotation(page_number - 1, note)

        for asset in page_assets:
            display_box = _asset_display_box(asset, marker_radius)
            if (
                display_box.x1 < 0
                or display_box.y1 < 0
                or display_box.x0 > display_width
                or display_box.y0 > display_height
            ):
                skipped += 1
                continue
            clipped = BoundingBox(
                x0=max(0, display_box.x0),
                y0=max(0, display_box.y0),
                x1=min(display_width, display_box.x1),
                y1=min(display_height, display_box.y1),
            )
            annotation = Rectangle(
                rect=_pdf_rect(page, clipped),
                title_bar=asset.unit_id,
            )
            writer.add_annotation(
                page_number - 1,
                _style_rectangle(
                    annotation, asset, color_for_code(asset.code)
                ),
            )
            annotated += 1

    writer.write(str(output_pdf))
    return AnnotationSummary(
        source_pdf=str(source_pdf),
        output_pdf=str(output_pdf),
        page_count=page_count,
        asset_count=len(asset_list),
        annotated_asset_count=annotated,
        skipped_asset_count=skipped,
        codes=dict(Counter(asset.code for asset in asset_list)),
    )
