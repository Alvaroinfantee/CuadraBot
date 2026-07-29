from __future__ import annotations

from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject

from app.annotations import (
    annotate_pdf,
    display_top_left_to_pdf,
)
from app.models import TakeoffAsset


def make_pdf(path: Path, *, rotate: int = 0) -> None:
    writer = PdfWriter()
    page = writer.add_blank_page(width=200, height=100)
    if rotate:
        page.rotate(rotate)
    writer.write(str(path))


def asset() -> TakeoffAsset:
    return TakeoffAsset(
        unit_id="TEST-LUM-001-0001",
        code="LUM",
        description="Test light",
        page=1,
        sheet="E-101",
        area_code="L1-A",
        area="Level 1 - Area A",
        level="1",
        method="counted",
        confidence="medium",
        x=50,
        y=25,
    )


def test_annotation_is_visible_and_searchable(tmp_path: Path) -> None:
    source = tmp_path / "source.pdf"
    output = tmp_path / "annotated.pdf"
    make_pdf(source)
    result = annotate_pdf(source, output, [asset()])

    assert result.annotated_asset_count == 1
    assert result.skipped_asset_count == 0
    annotations = PdfReader(str(output)).pages[0]["/Annots"]
    assert len(annotations) == 2
    resolved = [entry.get_object() for entry in annotations]
    square = next(
        item for item in resolved if item["/Subtype"] == NameObject("/Square")
    )
    assert square["/NM"] == "TEST-LUM-001-0001"
    assert "Level 1 - Area A" in square["/Contents"]
    assert list(square["/Rect"]) == [43, 68, 57, 82]


def test_rotated_page_coordinate_mapping(tmp_path: Path) -> None:
    source = tmp_path / "rotated.pdf"
    make_pdf(source, rotate=90)
    page = PdfReader(str(source)).pages[0]
    assert display_top_left_to_pdf(page, 50, 25) == (25, 50)


def test_free_sample_has_visible_locked_watermark(tmp_path: Path) -> None:
    source = tmp_path / "source.pdf"
    output = tmp_path / "sample.pdf"
    make_pdf(source)

    annotate_pdf(source, output, [asset()], sample_watermark=True)

    annotations = PdfReader(str(output)).pages[0]["/Annots"]
    resolved = [entry.get_object() for entry in annotations]
    watermark = next(
        item
        for item in resolved
        if item["/Subtype"] == NameObject("/FreeText")
    )
    assert watermark["/Contents"] == "CUADRABOT SAMPLE"
    assert watermark["/F"] == 196
