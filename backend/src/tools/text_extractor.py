"""Modular file text extraction with registry pattern.

Each extractor handles a set of file extensions. New formats are added
by writing a new extractor function and registering it in EXTRACTORS.
"""

from collections.abc import Callable
from pathlib import Path

import pymupdf


def _extract_plaintext(content: bytes, _filename: str) -> str:
    """Extract text from plain-text encoded files (UTF-8 with Latin-1 fallback)."""
    try:
        return content.decode("utf-8")
    except UnicodeDecodeError:
        return content.decode("latin-1")


def _extract_pdf(content: bytes, _filename: str) -> str:
    """Extract text from PDF files using PyMuPDF."""
    doc = pymupdf.open(stream=content, filetype="pdf")
    pages: list[str] = []
    for page in doc:
        text = page.get_text()
        if text.strip():
            pages.append(text)
    doc.close()
    return "\n".join(pages)


# ── Extractor Registry ────────────────────────────────────────────────
# Maps file extensions to their extraction function.
# To add a new format: write an extractor function above, then add its
# extensions here. The route and service layers need zero changes.

type ExtractorFn = Callable[[bytes, str], str]

EXTRACTORS: dict[str, ExtractorFn] = {}

_PLAINTEXT_EXTENSIONS = {
    ".txt", ".md", ".csv", ".json", ".xml", ".html",
    ".py", ".js", ".ts", ".yaml", ".yml", ".log",
}

for _ext in _PLAINTEXT_EXTENSIONS:
    EXTRACTORS[_ext] = _extract_plaintext

EXTRACTORS[".pdf"] = _extract_pdf

# Future: EXTRACTORS[".docx"] = _extract_docx
# Future: EXTRACTORS[".xlsx"] = _extract_xlsx

SUPPORTED_EXTENSIONS = set(EXTRACTORS.keys())


def extract_text(content: bytes, filename: str) -> str:
    """Extract text content from uploaded file bytes.

    Args:
        content: Raw file bytes.
        filename: Original filename for extension detection.

    Returns:
        Extracted text string.

    Raises:
        ValueError: If the file type is not supported.
    """
    ext = Path(filename).suffix.lower()
    extractor = EXTRACTORS.get(ext)
    if extractor is None:
        raise ValueError(
            f"Unsupported file type '{ext}'. Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )
    return extractor(content, filename)
