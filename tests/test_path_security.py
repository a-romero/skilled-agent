"""Tests for backend.utils.path_security module."""
import os
import sys
from pathlib import Path

import pytest
from backend.utils.path_security import validate_safe_path


class TestValidateSafePath:
    """Tests for validate_safe_path function."""
    
    def test_allows_path_directly_in_root(self, tmp_path: Path) -> None:
        """Allows a file directly in the root directory."""
        root = tmp_path / "root"
        root.mkdir()
        file_path = root / "file.txt"
        file_path.touch()
        
        # Should not raise
        validate_safe_path(file_path, root)
    
    def test_allows_path_in_subdirectory(self, tmp_path: Path) -> None:
        """Allows a file in a subdirectory of root."""
        root = tmp_path / "root"
        subdir = root / "subdir"
        subdir.mkdir(parents=True)
        file_path = subdir / "file.txt"
        file_path.touch()
        
        # Should not raise
        validate_safe_path(file_path, root)
    
    def test_allows_deeply_nested_path(self, tmp_path: Path) -> None:
        """Allows a file deeply nested in root."""
        root = tmp_path / "root"
        deep_dir = root / "a" / "b" / "c" / "d"
        deep_dir.mkdir(parents=True)
        file_path = deep_dir / "file.txt"
        file_path.touch()
        
        # Should not raise
        validate_safe_path(file_path, root)
    
    def test_allows_root_itself(self, tmp_path: Path) -> None:
        """Allows the root directory itself as the path."""
        root = tmp_path / "root"
        root.mkdir()
        
        # Should not raise
        validate_safe_path(root, root)
    
    def test_rejects_parent_directory_traversal(self, tmp_path: Path) -> None:
        """Rejects path that uses .. to escape root."""
        root = tmp_path / "root"
        root.mkdir()
        evil_path = root / ".." / "outside.txt"
        
        with pytest.raises(ValueError, match="outside the allowed root"):
            validate_safe_path(evil_path, root)
    
    def test_rejects_path_outside_root(self, tmp_path: Path) -> None:
        """Rejects a path that is completely outside root."""
        root = tmp_path / "root"
        root.mkdir()
        outside = tmp_path / "outside"
        outside.mkdir()
        evil_path = outside / "file.txt"
        evil_path.touch()
        
        with pytest.raises(ValueError, match="outside the allowed root"):
            validate_safe_path(evil_path, root)
    
    def test_rejects_sibling_directory_access(self, tmp_path: Path) -> None:
        """Rejects access to sibling directory of root."""
        root = tmp_path / "root"
        root.mkdir()
        sibling = tmp_path / "sibling"
        sibling.mkdir()
        evil_path = sibling / "file.txt"
        evil_path.touch()
        
        with pytest.raises(ValueError, match="outside the allowed root"):
            validate_safe_path(evil_path, root)
    
    def test_rejects_multiple_parent_traversal(self, tmp_path: Path) -> None:
        """Rejects path with multiple .. components."""
        root = tmp_path / "root" / "deep" / "nested"
        root.mkdir(parents=True)
        evil_path = root / ".." / ".." / ".." / "outside.txt"
        
        with pytest.raises(ValueError, match="outside the allowed root"):
            validate_safe_path(evil_path, root)
    
    def test_rejects_absolute_path_outside_root(self, tmp_path: Path) -> None:
        """Rejects an absolute path pointing outside root."""
        root = tmp_path / "root"
        root.mkdir()
        evil_path = Path("/etc/passwd")
        
        with pytest.raises(ValueError, match="outside the allowed root"):
            validate_safe_path(evil_path, root)
    
    def test_handles_symlink_pointing_outside_root(self, tmp_path: Path) -> None:
        """Detects symlink that points outside root (symlink attack)."""
        root = tmp_path / "root"
        root.mkdir()
        outside = tmp_path / "outside"
        outside.mkdir()
        target = outside / "secret.txt"
        target.write_text("secret data")
        
        symlink = root / "link.txt"
        symlink.symlink_to(target)
        
        # Symlink resolves to outside root, should be rejected
        with pytest.raises(ValueError, match="outside the allowed root"):
            validate_safe_path(symlink, root)
    
    def test_allows_symlink_pointing_inside_root(self, tmp_path: Path) -> None:
        """Allows symlink that points to a file inside root."""
        root = tmp_path / "root"
        root.mkdir()
        target = root / "target.txt"
        target.write_text("safe data")
        
        symlink = root / "link.txt"
        symlink.symlink_to(target)
        
        # Symlink resolves to inside root, should be allowed
        validate_safe_path(symlink, root)
    
    def test_handles_nonexistent_path(self, tmp_path: Path) -> None:
        """Handles validation of a path that doesn't exist yet."""
        root = tmp_path / "root"
        root.mkdir()
        nonexistent = root / "future_file.txt"
        
        # Should not raise even if file doesn't exist
        validate_safe_path(nonexistent, root)
    
    def test_handles_nonexistent_path_with_traversal(self, tmp_path: Path) -> None:
        """Rejects nonexistent path that would escape root."""
        root = tmp_path / "root"
        root.mkdir()
        evil_nonexistent = root / ".." / "evil.txt"
        
        with pytest.raises(ValueError, match="outside the allowed root"):
            validate_safe_path(evil_nonexistent, root)
    
    def test_normalizes_relative_path_components(self, tmp_path: Path) -> None:
        """Normalizes paths with . and .. components correctly."""
        root = tmp_path / "root"
        subdir = root / "subdir"
        subdir.mkdir(parents=True)
        
        # Path with . and .. but still inside root
        safe_path = root / "subdir" / "." / "file.txt"
        validate_safe_path(safe_path, root)
        
        # Path that uses .. but stays inside root
        safe_path2 = root / "subdir" / ".." / "subdir" / "file.txt"
        validate_safe_path(safe_path2, root)
    
    @pytest.mark.skipif(sys.platform != "win32", reason="Windows-specific test")
    def test_handles_windows_path_separators(self, tmp_path: Path) -> None:
        """Handles Windows-style path separators correctly."""
        root = tmp_path / "root"
        root.mkdir()
        # Path with mixed separators
        file_path = root / "subdir\\file.txt"
        
        # Should handle Windows separators correctly
        validate_safe_path(file_path, root)
    
    @pytest.mark.skipif(sys.platform != "win32", reason="Windows-specific test")
    def test_rejects_windows_path_traversal(self, tmp_path: Path) -> None:
        """Rejects Windows-style path traversal."""
        root = tmp_path / "root"
        root.mkdir()
        evil_path = root / "..\\..\\..\\windows\\system32\\config\\sam"
        
        with pytest.raises(ValueError, match="outside the allowed root"):
            validate_safe_path(evil_path, root)
    
    def test_handles_root_with_trailing_slash(self, tmp_path: Path) -> None:
        """Handles root path with trailing slash correctly."""
        root_str = str(tmp_path / "root") + os.sep
        root = Path(root_str)
        root.mkdir(exist_ok=True)
        
        file_path = root / "file.txt"
        validate_safe_path(file_path, root)
    
    def test_rejects_null_byte_in_path(self, tmp_path: Path) -> None:
        """Rejects path containing null byte (null byte injection attack)."""
        root = tmp_path / "root"
        root.mkdir()
        
        # Null byte injection attempt
        try:
            evil_path = root / "file.txt\x00.md"
            # If path creation succeeds, validation should still protect
            with pytest.raises((ValueError, OSError)):
                validate_safe_path(evil_path, root)
        except (ValueError, OSError):
            # Some systems reject null bytes at Path creation, which is fine
            pass
    
    def test_case_sensitivity_on_case_sensitive_systems(self, tmp_path: Path) -> None:
        """Path validation respects filesystem case sensitivity."""
        root = tmp_path / "root"
        root.mkdir()
        
        # Create file with lowercase name
        file_path = root / "file.txt"
        file_path.touch()
        
        # Validation should work regardless of case
        validate_safe_path(file_path, root)
        
        # On case-insensitive systems, different case should still work
        # On case-sensitive systems, this is a different (nonexistent) file
        uppercase_path = root / "FILE.TXT"
        validate_safe_path(uppercase_path, root)  # Should not raise
    
    def test_resolves_symlinked_root(self, tmp_path: Path) -> None:
        """Handles case where root itself is a symlink."""
        actual_root = tmp_path / "actual_root"
        actual_root.mkdir()
        symlinked_root = tmp_path / "symlinked_root"
        symlinked_root.symlink_to(actual_root)
        
        file_path = symlinked_root / "file.txt"
        file_path.touch()
        
        # Should allow, as symlink resolution makes it inside root
        validate_safe_path(file_path, symlinked_root)
    
    def test_rejects_path_when_symlinked_root_escapes(self, tmp_path: Path) -> None:
        """Rejects path outside symlinked root."""
        actual_root = tmp_path / "actual_root"
        actual_root.mkdir()
        symlinked_root = tmp_path / "symlinked_root"
        symlinked_root.symlink_to(actual_root)
        
        outside = tmp_path / "outside"
        outside.mkdir()
        evil_path = outside / "file.txt"
        evil_path.touch()
        
        with pytest.raises(ValueError, match="outside the allowed root"):
            validate_safe_path(evil_path, symlinked_root)
