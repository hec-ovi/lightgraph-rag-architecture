from pathlib import Path


SUPPORTED_EXTENSIONS = {".txt", ".md", ".csv", ".json", ".xml", ".html", ".py", ".js", ".ts", ".yaml", ".yml", ".log"}


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
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported file type '{ext}'. Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}")

    try:
        return content.decode("utf-8")
    except UnicodeDecodeError:
        return content.decode("latin-1")
