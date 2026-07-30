from __future__ import annotations

from pathlib import Path

import pytest
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
        legend_entry_id="LEGEND-LUM",
        measurement_kind="count",
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


def linear_asset() -> TakeoffAsset:
    return TakeoffAsset(
        unit_id="TEST-CBL-001-0001",
        legend_entry_id="LEGEND-CBL",
        measurement_kind="linear",
        code="CBL",
        description="Test cable run",
        page=1,
        sheet="E-101",
        area_code="L1-A",
        area="Level 1 - Area A",
        level="1",
        method="scaled centerline",
        confidence="high",
        path=[
            {"x": 20, "y": 80},
            {"x": 80, "y": 80},
        ],
        scale_evidence={
            "kind": "calibrated_dimension",
            "page": 1,
            "sheet": "E-101",
            "bbox": {"x0": 20, "y0": 85, "x1": 80, "y1": 95},
            "source_text": "30 ft calibration",
            "real_units_per_pdf_point": 0.5,
            "unit": "ft",
            "calibration": {
                "start": {"x": 20, "y": 90},
                "end": {"x": 80, "y": 90},
                "known_length": 30,
                "unit": "ft",
            },
        },
        quantity=30,
        unit="ft",
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


def test_linear_run_is_a_visible_searchable_polyline(tmp_path: Path) -> None:
    source = tmp_path / "source.pdf"
    output = tmp_path / "annotated.pdf"
    make_pdf(source)

    result = annotate_pdf(source, output, [linear_asset()])

    assert result.annotated_asset_count == 1
    assert result.skipped_asset_count == 0
    annotations = PdfReader(str(output)).pages[0]["/Annots"]
    resolved = [entry.get_object() for entry in annotations]
    polyline = next(
        item
        for item in resolved
        if item["/Subtype"] == NameObject("/PolyLine")
    )
    assert polyline["/NM"] == "TEST-CBL-001-0001"
    assert "Legend entry: LEGEND-CBL" in polyline["/Contents"]
    assert "Quantity: 30 ft" in polyline["/Contents"]
    assert list(polyline["/Vertices"]) == [20, 20, 80, 20]
    assert float(polyline["/BS"]["/W"]) == 2.2


@pytest.mark.parametrize(
    ("position", "expected_rect"),
    [
        ((0, 50), [0, 43, 7, 57]),
        ((200, 50), [193, 43, 200, 57]),
        ((100, 0), [93, 93, 107, 100]),
        ((100, 100), [93, 0, 107, 7]),
    ],
)
def test_point_marker_is_clipped_at_every_page_edge(
    tmp_path: Path,
    position: tuple[float, float],
    expected_rect: list[float],
) -> None:
    source = tmp_path / "source.pdf"
    output = tmp_path / "annotated.pdf"
    make_pdf(source)
    edge_asset = asset().model_copy(
        update={
            "unit_id": f"EDGE-{position[0]}-{position[1]}",
            "x": position[0],
            "y": position[1],
        }
    )

    result = annotate_pdf(source, output, [edge_asset])

    assert result.annotated_asset_count == 1
    annotations = PdfReader(str(output)).pages[0]["/Annots"]
    square = next(
        entry.get_object()
        for entry in annotations
        if entry.get_object()["/Subtype"] == NameObject("/Square")
    )
    assert [float(value) for value in square["/Rect"]] == expected_rect


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
