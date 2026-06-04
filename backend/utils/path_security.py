"""Path traversal protection utilities."""
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def validate_safe_path(path: Path, root: Path) -> None:
    """Validate that path is within root directory (prevent path traversal).
    
    Args:
        path: Path to validate
        root: Root directory that path must be within
    
    Raises:
        ValueError: If path is outside root directory
    """
    resolved_path = path.resolve()
    resolved_root = root.resolve()
    
    # Check if path is within root (either is root or has root as parent)
    if resolved_root not in resolved_path.parents and resolved_path != resolved_root:
        logger.warning(f"Path traversal attempt detected: {path} outside {root}")
        raise ValueError(f"Path is outside the allowed root directory")
