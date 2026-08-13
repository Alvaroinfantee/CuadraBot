from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest


SCRIPT = (
    Path(__file__).resolve().parents[1]
    / "skills"
    / "analyze-building-drawings"
    / "scripts"
    / "prepare_drawings.py"
)
SPEC = importlib.util.spec_from_file_location("cuadrabot_prepare_drawings", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
PREPARE_DRAWINGS = importlib.util.module_from_spec(SPEC)
_previous_bytecode_setting = sys.dont_write_bytecode
try:
    sys.dont_write_bytecode = True
    SPEC.loader.exec_module(PREPARE_DRAWINGS)
finally:
    sys.dont_write_bytecode = _previous_bytecode_setting


def test_parses_poppler_bbox_layout_into_api_coordinate_evidence() -> None:
    xml = """<?xml version="1.0" encoding="UTF-8"?>
    <html xmlns="http://www.w3.org/1999/xhtml">
      <body><doc><page width="2592.000000" height="1728.000000">
        <flow><block><line>
          <word xMin="110.5" yMin="210.25" xMax="165.75" yMax="225.5">HIEL-01</word>
          <word xMin="170" yMin="210.25" xMax="230" yMax="225.5">LIGHTING</word>
        </line></block></flow>
      </page></doc></body>
    </html>"""

    text, words, width, height = PREPARE_DRAWINGS.parse_poppler_bbox(xml)

    assert text == "HIEL-01 LIGHTING"
    assert (width, height) == (2592.0, 1728.0)
    assert words == [
        {
            "text": "HIEL-01",
            "x0": 110.5,
            "x1": 165.75,
            "top": 210.25,
            "bottom": 225.5,
            "upright": True,
            "height": 15.25,
            "width": 55.25,
            "direction": "ltr",
        },
        {
            "text": "LIGHTING",
            "x0": 170.0,
            "x1": 230.0,
            "top": 210.25,
            "bottom": 225.5,
            "upright": True,
            "height": 15.25,
            "width": 60.0,
            "direction": "ltr",
        },
    ]


@pytest.mark.parametrize(
    "xml",
    [
        "<not-xml",
        "<html><body /></html>",
        (
            "<html><page width='100' height='100'><line>"
            "<word xMin='20' yMin='10' xMax='5' yMax='30'>X</word>"
            "</line></page></html>"
        ),
        "<html><page width='0' height='100' /></html>",
        "<html><page width='inf' height='100' /></html>",
    ],
)
def test_rejects_malformed_or_inverted_poppler_geometry(xml: str) -> None:
    with pytest.raises(RuntimeError):
        PREPARE_DRAWINGS.parse_poppler_bbox(xml)


def test_extracts_only_requested_cropbox_page_with_poppler(monkeypatch: pytest.MonkeyPatch) -> None:
    xml = "<html><page width='100' height='200' /></html>"
    captured: dict[str, object] = {}

    monkeypatch.setattr(PREPARE_DRAWINGS.shutil, "which", lambda name: "/usr/bin/pdftotext")

    def fake_run(command: list[str], **kwargs: object) -> SimpleNamespace:
        captured["command"] = command
        captured["kwargs"] = kwargs
        return SimpleNamespace(returncode=0, stdout=xml, stderr="")

    monkeypatch.setattr(PREPARE_DRAWINGS.subprocess, "run", fake_run)

    result = PREPARE_DRAWINGS.extract_positioned_text(Path("drawing.pdf"), 7)

    assert result == ("", [], 100.0, 200.0)
    assert captured["command"] == [
        "/usr/bin/pdftotext",
        "-f",
        "7",
        "-l",
        "7",
        "-bbox-layout",
        "-cropbox",
        "drawing.pdf",
        "-",
    ]
    assert captured["kwargs"] == {
        "capture_output": True,
        "text": True,
        "encoding": "utf-8",
        "errors": "replace",
    }
