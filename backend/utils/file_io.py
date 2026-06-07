"""Safe file I/O utilities with consistent error handling."""
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def safe_read_text(path: Path, encoding: str = "utf-8") -> str:
    """Read file with consistent error handling and logging.
    
    Args:
        path: Path to file to read
        encoding: Text encoding (default: utf-8)
    
    Returns:
        File contents as string
    
    Raises:
        FileNotFoundError: If file doesn't exist
        IOError: If file cannot be read
    """
    try:
        return path.read_text(encoding=encoding)
    except FileNotFoundError:
        logger.error(f"File not found: {path}")
        raise
    except Exception as e:
        logger.error(f"Failed to read file {path}: {e}", exc_info=True)
        raise IOError(f"Failed to read file {path}: {e}") from e
