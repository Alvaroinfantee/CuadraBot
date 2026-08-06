from __future__ import annotations

from pathlib import Path

import pytest
from pypdf import PdfReader, PdfWriter
from pypdf.annotations import Rectangle
from pypdf.errors import PdfReadError
from pypdf.generic import NameObject, RectangleObject, TextStringObject

from app.annotations import (
    TAKEOFF_MARKER_KEY,
    annotate_pdf,
    display_top_left_to_pdf,
    displayed_size,
)
from app.models import TakeoffAsset
from app.validation import ArtifactValidationError, validate_pdf_artifact


def make_pdf(path: Path, *, rotate: int = 0) -> None:
    writer = PdfWriter()
    page = writer.add_blank_page(width=200, height=100)
    if rotate:
        page.rotate(rotate)
    writer.write(str(path))


def make_duplicate_page_mode_pdf(path: Path) -> None:
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=100)
    writer.root_object.update(
        {
            NameObject("/PageMode"): NameObject("/UseNone"),
            NameObject("/PageMope"): NameObject("/UseNone"),
        }
    )
    writer.write(str(path))
    payload = path.read_bytes()
    placeholder = b"/PageMope /UseNone"
    assert payload.count(placeholder) == 1
    path.write_bytes(
        payload.replace(placeholder, b"/PageMode /UseNone", 1)
    )


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


def test_reannotating_removes_only_prior_takeoff_markers(
    tmp_path: Path,
) -> None:
    source = tmp_path / "source.pdf"
    first_output = tmp_path / "first-annotated.pdf"
    second_output = tmp_path / "second-annotated.pdf"

    writer = PdfWriter()
    writer.add_blank_page(width=200, height=100)
    source_review = Rectangle(rect=(10, 10, 30, 30))
    source_review[NameObject("/NM")] = TextStringObject("SOURCE-REVIEW")
    writer.add_annotation(0, source_review)
    writer.write(str(source))

    annotate_pdf(
        source,
        first_output,
        [asset(), linear_asset()],
        add_page_notes=False,
    )
    replacement = asset().model_copy(
        update={"unit_id": "TEST-LUM-001-0002", "x": 150}
    )
    annotate_pdf(
        first_output,
        second_output,
        [replacement],
        add_page_notes=False,
    )

    annotations = [
        entry.get_object()
        for entry in PdfReader(str(second_output)).pages[0]["/Annots"]
    ]
    takeoff_ids = {
        str(annotation["/NM"])
        for annotation in annotations
        if getattr(
            annotation.get(TAKEOFF_MARKER_KEY),
            "value",
            False,
        )
        is True
    }

    assert takeoff_ids == {"TEST-LUM-001-0002"}
    assert any(
        str(annotation.get("/NM", "")) == "SOURCE-REVIEW"
        and annotation.get(TAKEOFF_MARKER_KEY) is None
        for annotation in annotations
    )
    assert len(annotations) == 2


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


def test_annotation_uses_visible_cropbox_and_nonzero_pdf_origin(
    tmp_path: Path,
) -> None:
    source = tmp_path / "cropped-origin.pdf"
    output = tmp_path / "annotated.pdf"
    writer = PdfWriter()
    page = writer.add_blank_page(width=300, height=200)
    page.mediabox = RectangleObject((100, 200, 400, 400))
    page.cropbox = RectangleObject((125, 225, 375, 375))
    writer.write(str(source))

    source_page = PdfReader(str(source)).pages[0]
    assert displayed_size(source_page) == (250, 150)
    assert display_top_left_to_pdf(source_page, 20, 30) == (145, 345)

    cropped_asset = asset().model_copy(
        update={"unit_id": "CROPPED-001", "x": 20, "y": 30}
    )
    result = annotate_pdf(
        source,
        output,
        [cropped_asset],
        add_page_notes=False,
    )

    assert result.annotated_asset_count == 1
    annotations = PdfReader(str(output)).pages[0]["/Annots"]
    square = next(
        entry.get_object()
        for entry in annotations
        if entry.get_object()["/Subtype"] == NameObject("/Square")
    )
    assert [float(value) for value in square["/Rect"]] == [138, 338, 152, 352]


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


def test_pdf_validation_reconciles_count_and_linear_marker_ids(
    tmp_path: Path,
) -> None:
    source = tmp_path / "source.pdf"
    output = tmp_path / "annotated.pdf"
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=100)
    writer.add_annotation(0, Rectangle(rect=(10, 10, 30, 30)))
    writer.write(str(source))
    annotate_pdf(
        source,
        output,
        [asset(), linear_asset()],
        sample_watermark=True,
    )

    validate_pdf_artifact(
        output,
        artifacts_dir=tmp_path,
        expected_pages=1,
        expected_annotation_ids={
            "TEST-LUM-001-0001",
            "TEST-CBL-001-0001",
        },
    )


def test_pdf_validation_accepts_duplicate_page_mode_from_source(
    tmp_path: Path,
) -> None:
    source = tmp_path / "source.pdf"
    output = tmp_path / "annotated.pdf"
    make_duplicate_page_mode_pdf(source)

    with pytest.raises(PdfReadError, match=r"key /PageMode"):
        len(PdfReader(str(source), strict=True).pages)

    annotate_pdf(source, output, [asset()])

    with pytest.raises(PdfReadError, match=r"key /PageMode"):
        len(PdfReader(str(output), strict=True).pages)

    validate_pdf_artifact(
        output,
        artifacts_dir=tmp_path,
        expected_pages=1,
        expected_annotation_ids={"TEST-LUM-001-0001"},
    )


def test_pdf_validation_rejects_missing_marker_ids(tmp_path: Path) -> None:
    output = tmp_path / "annotated.pdf"
    make_pdf(output)

    with pytest.raises(ArtifactValidationError, match="1 missing"):
        validate_pdf_artifact(
            output,
            artifacts_dir=tmp_path,
            expected_pages=1,
            expected_annotation_ids={"TEST-LUM-001-0001"},
        )


def test_pdf_validation_rejects_duplicate_marker_ids(tmp_path: Path) -> None:
    source = tmp_path / "source.pdf"
    output = tmp_path / "annotated.pdf"
    make_pdf(source)
    annotate_pdf(source, output, [asset(), asset()])

    with pytest.raises(ArtifactValidationError, match="duplicate.*ID"):
        validate_pdf_artifact(
            output,
            artifacts_dir=tmp_path,
            expected_pages=1,
            expected_annotation_ids={"TEST-LUM-001-0001"},
        )


@pytest.mark.parametrize("annotation_id", [None, " "])
def test_pdf_validation_rejects_missing_or_blank_marker_id(
    tmp_path: Path,
    annotation_id: str | None,
) -> None:
    source = tmp_path / "source.pdf"
    annotated = tmp_path / "annotated.pdf"
    mutated = tmp_path / "mutated.pdf"
    make_pdf(source)
    annotate_pdf(source, annotated, [asset()])

    writer = PdfWriter()
    writer.clone_document_from_reader(PdfReader(str(annotated)))
    square = next(
        entry.get_object()
        for entry in writer.pages[0]["/Annots"]
        if entry.get_object()["/Subtype"] == NameObject("/Square")
    )
    if annotation_id is None:
        del square["/NM"]
    else:
        square[NameObject("/NM")] = TextStringObject(annotation_id)
    writer.write(str(mutated))

    with pytest.raises(
        ArtifactValidationError,
        match="without an ID|with a blank ID",
    ):
        validate_pdf_artifact(
            mutated,
            artifacts_dir=tmp_path,
            expected_pages=1,
            expected_annotation_ids={"TEST-LUM-001-0001"},
        )


def test_pdf_validation_rejects_unexpected_marker_ids(
    tmp_path: Path,
) -> None:
    source = tmp_path / "source.pdf"
    output = tmp_path / "annotated.pdf"
    make_pdf(source)
    annotate_pdf(source, output, [asset()])

    with pytest.raises(ArtifactValidationError, match="1 unexpected"):
        validate_pdf_artifact(
            output,
            artifacts_dir=tmp_path,
            expected_pages=1,
            expected_annotation_ids=set(),
        )
