"""YAML frontmatter parsing utilities."""
import logging
from pathlib import Path
from typing import Any

import yaml

from backend.utils.file_io import safe_read_text

logger = logging.getLogger(__name__)


def parse_index_md(path: Path) -> dict[str, Any]:
    """Parse YAML frontmatter from markdown file.
    
    Args:
        path: Path to markdown file with optional YAML frontmatter
    
    Returns:
        Dict with 'frontmatter' (dict) and 'body' (str) keys
    """
    try:
        text = safe_read_text(path)
    except Exception as e:
        logger.warning(f"Failed to read {path}: {e}")
        return {"frontmatter": {}, "body": ""}

    # Check for YAML frontmatter (--- at start)
    if not text.startswith("---"):
        return {"frontmatter": {}, "body": text}

    # Find closing ---
    end = text.find("---", 3)
    if end == -1:
        return {"frontmatter": {}, "body": text}

    # Extract and parse frontmatter
    fm_raw = text[3:end]
    body = text[end + 3:].strip()
    
    try:
        fm = yaml.safe_load(fm_raw) or {}
    except Exception as e:
        logger.warning(f"Failed to parse YAML frontmatter in {path}: {e}")
        fm = {}
    
    return {"frontmatter": fm, "body": body}
