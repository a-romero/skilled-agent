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
    
    Raises:
        FileNotFoundError: If file doesn't exist
        IOError: If file cannot be read
    """
    try:
        text = safe_read_text(path)
    except FileNotFoundError:
        logger.error(f"File not found: {path}")
        raise
    except IOError as e:
        logger.error(f"Failed to read {path}: {e}", exc_info=True)
        raise

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
    except yaml.YAMLError as e:
        logger.warning(f"Failed to parse YAML frontmatter in {path}: {e}")
        fm = {}
    
    return {"frontmatter": fm, "body": body}
