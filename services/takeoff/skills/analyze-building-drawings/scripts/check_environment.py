#!/usr/bin/env python3
"""Check portable runtime dependencies for the drawing analyzer skill."""

from __future__ import annotations

import importlib.util
import platform
import shutil
import sys
from pathlib import Path


def main() -> int:
    required_modules = {
        "pdfplumber": "pdfplumber",
        "PIL": "Pillow",
    }
    missing_modules = [
        package
        for module, package in required_modules.items()
        if importlib.util.find_spec(module) is None
    ]
    pdftoppm = shutil.which("pdftoppm")
    tesseract = shutil.which("tesseract")
    requirements = Path(__file__).with_name("requirements.txt")

    print("Drawing analyzer environment check")
    print(f"  Platform: {platform.platform()}")
    print(f"  Python: {sys.version.split()[0]} ({sys.executable})")
    print(
        "  Python packages: "
        + ("ok" if not missing_modules else f"missing {', '.join(missing_modules)}")
    )
    print(f"  pdftoppm (required): {pdftoppm or 'missing'}")
    print(f"  tesseract (optional): {tesseract or 'missing'}")

    if missing_modules:
        print(
            "Install Python dependencies with:\n"
            f"  {sys.executable} -m pip install -r {requirements}",
            file=sys.stderr,
        )
    if not pdftoppm:
        print(
            "Install Poppler for the host operating system so pdftoppm is on PATH.",
            file=sys.stderr,
        )
    if not tesseract:
        print(
            "Optional: install Tesseract to OCR scanned or text-poor pages.",
            file=sys.stderr,
        )
    return 2 if missing_modules or not pdftoppm else 0


if __name__ == "__main__":
    raise SystemExit(main())
