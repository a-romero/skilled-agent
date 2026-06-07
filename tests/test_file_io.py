"""Tests for backend.utils.file_io module."""
from pathlib import Path

import pytest
from backend.utils.file_io import safe_read_text


class TestSafeReadText:
    """Tests for safe_read_text function."""
    
    def test_reads_text_file(self, tmp_path: Path) -> None:
        """Reads text file content successfully."""
        file_path = tmp_path / "test.txt"
        content = "Hello, World!"
        file_path.write_text(content)
        
        result = safe_read_text(file_path)
        
        assert result == content
    
    def test_reads_multiline_content(self, tmp_path: Path) -> None:
        """Reads multiline text content."""
        file_path = tmp_path / "multiline.txt"
        content = "Line 1\nLine 2\nLine 3"
        file_path.write_text(content)
        
        result = safe_read_text(file_path)
        
        assert result == content
    
    def test_reads_empty_file(self, tmp_path: Path) -> None:
        """Reads empty file and returns empty string."""
        file_path = tmp_path / "empty.txt"
        file_path.touch()
        
        result = safe_read_text(file_path)
        
        assert result == ""
    
    def test_raises_file_not_found_error_for_nonexistent_file(
        self, tmp_path: Path
    ) -> None:
        """Raises FileNotFoundError when file doesn't exist."""
        file_path = tmp_path / "nonexistent.txt"
        
        with pytest.raises(FileNotFoundError):
            safe_read_text(file_path)
    
    def test_reads_with_utf8_encoding_by_default(self, tmp_path: Path) -> None:
        """Uses UTF-8 encoding by default."""
        file_path = tmp_path / "unicode.txt"
        content = "Hello 世界 🌍"
        file_path.write_text(content, encoding="utf-8")
        
        result = safe_read_text(file_path)
        
        assert result == content
    
    def test_reads_with_custom_encoding(self, tmp_path: Path) -> None:
        """Reads file with custom encoding."""
        file_path = tmp_path / "latin1.txt"
        content = "café"
        file_path.write_text(content, encoding="latin-1")
        
        result = safe_read_text(file_path, encoding="latin-1")
        
        assert result == content
    
    def test_raises_io_error_on_encoding_error(self, tmp_path: Path) -> None:
        """Raises IOError when encoding is incompatible."""
        file_path = tmp_path / "utf8.txt"
        content = "Hello 世界"
        file_path.write_text(content, encoding="utf-8")
        
        # Try to read UTF-8 file as ASCII
        with pytest.raises(IOError, match="Failed to read file"):
            safe_read_text(file_path, encoding="ascii")
    
    def test_raises_io_error_on_permission_error(self, tmp_path: Path) -> None:
        """Raises IOError when file cannot be read due to permissions."""
        file_path = tmp_path / "restricted.txt"
        file_path.write_text("content")
        file_path.chmod(0o000)  # Remove all permissions
        
        try:
            with pytest.raises(IOError, match="Failed to read file"):
                safe_read_text(file_path)
        finally:
            # Restore permissions for cleanup
            file_path.chmod(0o644)
    
    def test_raises_io_error_when_path_is_directory(self, tmp_path: Path) -> None:
        """Raises IOError when path points to a directory."""
        dir_path = tmp_path / "directory"
        dir_path.mkdir()
        
        with pytest.raises(IOError, match="Failed to read file"):
            safe_read_text(dir_path)
    
    def test_reads_large_file(self, tmp_path: Path) -> None:
        """Reads large file successfully."""
        file_path = tmp_path / "large.txt"
        content = "x" * 1_000_000  # 1MB of 'x'
        file_path.write_text(content)
        
        result = safe_read_text(file_path)
        
        assert result == content
    
    def test_preserves_whitespace(self, tmp_path: Path) -> None:
        """Preserves leading/trailing whitespace."""
        file_path = tmp_path / "whitespace.txt"
        content = "  \n  Leading and trailing  \n  "
        file_path.write_text(content)
        
        result = safe_read_text(file_path)
        
        assert result == content
    
    def test_reads_markdown_file(self, tmp_path: Path) -> None:
        """Reads markdown file with frontmatter."""
        file_path = tmp_path / "test.md"
        content = """---
title: Test
---

# Heading

Body text."""
        file_path.write_text(content)
        
        result = safe_read_text(file_path)
        
        assert result == content
    
    def test_reads_json_file_as_text(self, tmp_path: Path) -> None:
        """Reads JSON file as plain text."""
        file_path = tmp_path / "data.json"
        content = '{"key": "value", "number": 42}'
        file_path.write_text(content)
        
        result = safe_read_text(file_path)
        
        assert result == content
    
    def test_reads_python_file(self, tmp_path: Path) -> None:
        """Reads Python source file."""
        file_path = tmp_path / "script.py"
        content = """def hello():
    print("Hello, World!")

if __name__ == "__main__":
    hello()
"""
        file_path.write_text(content)
        
        result = safe_read_text(file_path)
        
        assert result == content
    
    def test_handles_special_characters(self, tmp_path: Path) -> None:
        """Handles special characters in content."""
        file_path = tmp_path / "special.txt"
        content = "Special chars: \\n \\t \\r \\\\ \" '"
        file_path.write_text(content)
        
        result = safe_read_text(file_path)
        
        assert result == content
    
    def test_reads_file_with_bom(self, tmp_path: Path) -> None:
        """Reads file with UTF-8 BOM."""
        file_path = tmp_path / "bom.txt"
        content = "Content with BOM"
        file_path.write_bytes(b"\xef\xbb\xbf" + content.encode("utf-8"))
        
        result = safe_read_text(file_path, encoding="utf-8-sig")
        
        assert result == content
    
    def test_error_message_includes_path(self, tmp_path: Path) -> None:
        """Error message includes the file path for debugging."""
        file_path = tmp_path / "nonexistent.txt"
        
        with pytest.raises(FileNotFoundError):
            safe_read_text(file_path)
    
    def test_wraps_generic_exceptions_as_io_error(self, tmp_path: Path) -> None:
        """Wraps unexpected exceptions as IOError."""
        file_path = tmp_path / "bad.txt"
        file_path.write_bytes(b"\xff\xfe")  # Invalid UTF-8
        
        with pytest.raises(IOError, match="Failed to read file"):
            safe_read_text(file_path, encoding="utf-8")
    
    def test_reads_relative_path(self, tmp_path: Path) -> None:
        """Reads file specified with relative path."""
        import os
        original_cwd = Path.cwd()
        try:
            os.chdir(tmp_path)
            file_path = Path("relative.txt")
            content = "Relative path content"
            file_path.write_text(content)
            
            result = safe_read_text(file_path)
            
            assert result == content
        finally:
            os.chdir(original_cwd)
    
    def test_reads_absolute_path(self, tmp_path: Path) -> None:
        """Reads file specified with absolute path."""
        file_path = tmp_path / "absolute.txt"
        content = "Absolute path content"
        file_path.write_text(content)
        
        result = safe_read_text(file_path.resolve())
        
        assert result == content
    
    def test_handles_file_with_no_extension(self, tmp_path: Path) -> None:
        """Reads file without extension."""
        file_path = tmp_path / "noext"
        content = "File without extension"
        file_path.write_text(content)
        
        result = safe_read_text(file_path)
        
        assert result == content
