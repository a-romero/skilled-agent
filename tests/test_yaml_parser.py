"""Tests for backend.utils.yaml_parser module."""
from pathlib import Path

import pytest
from backend.utils.yaml_parser import parse_index_md


class TestParseIndexMd:
    """Tests for parse_index_md function."""
    
    def test_parses_frontmatter_and_body(self, tmp_path: Path) -> None:
        """Parses YAML frontmatter and markdown body."""
        file_path = tmp_path / "test.md"
        content = """---
title: Test Page
description: A test page
---

# Heading

Body content here."""
        file_path.write_text(content)
        
        result = parse_index_md(file_path)
        
        assert result["frontmatter"] == {
            "title": "Test Page",
            "description": "A test page",
        }
        assert "# Heading" in result["body"]
        assert "Body content here." in result["body"]
    
    def test_returns_empty_frontmatter_when_no_yaml(self, tmp_path: Path) -> None:
        """Returns empty frontmatter dict when file has no YAML."""
        file_path = tmp_path / "no-frontmatter.md"
        content = "# Just a heading\n\nJust body text."
        file_path.write_text(content)
        
        result = parse_index_md(file_path)
        
        assert result["frontmatter"] == {}
        assert result["body"] == content
    
    def test_raises_for_nonexistent_file(self, tmp_path: Path) -> None:
        """Raises FileNotFoundError for nonexistent file."""
        file_path = tmp_path / "nonexistent.md"
        
        with pytest.raises(FileNotFoundError):
            parse_index_md(file_path)
    
    def test_parses_empty_frontmatter(self, tmp_path: Path) -> None:
        """Parses file with empty frontmatter section."""
        file_path = tmp_path / "empty-fm.md"
        content = """---
---

Body content."""
        file_path.write_text(content)
        
        result = parse_index_md(file_path)
        
        assert result["frontmatter"] == {}
        assert result["body"] == "Body content."
    
    def test_handles_frontmatter_without_closing_delimiter(self, tmp_path: Path) -> None:
        """Handles when --- appears in content but isn't a real delimiter."""
        file_path = tmp_path / "unclosed.md"
        content = """---
title: Unclosed

Body without proper closing"""
        file_path.write_text(content)
        
        result = parse_index_md(file_path)
        
        # When there's no second ---, find() returns -1, and it returns
        # the whole content as body
        assert result["frontmatter"] == {}
        assert result["body"] == content
    
    def test_parses_complex_yaml_frontmatter(self, tmp_path: Path) -> None:
        """Parses complex YAML with nested structures."""
        file_path = tmp_path / "complex.md"
        content = """---
title: Complex Page
metadata:
  author: John Doe
  date: 2024-01-01
tags:
  - python
  - testing
count: 42
---

Body."""
        file_path.write_text(content)
        
        result = parse_index_md(file_path)
        
        assert result["frontmatter"]["title"] == "Complex Page"
        assert result["frontmatter"]["metadata"]["author"] == "John Doe"
        assert result["frontmatter"]["tags"] == ["python", "testing"]
        assert result["frontmatter"]["count"] == 42
    
    def test_strips_whitespace_from_body(self, tmp_path: Path) -> None:
        """Strips leading/trailing whitespace from body."""
        file_path = tmp_path / "whitespace.md"
        content = """---
title: Test
---


Body with extra newlines above


"""
        file_path.write_text(content)
        
        result = parse_index_md(file_path)
        
        # Body should be stripped of leading/trailing whitespace
        assert result["body"].startswith("Body")
        assert not result["body"].startswith("\\n")
    
    def test_handles_dashes_in_body(self, tmp_path: Path) -> None:
        """Handles dashes in body content correctly."""
        file_path = tmp_path / "dashes.md"
        content = """---
title: Test
---

Body with --- dashes in it.
And more --- dashes here."""
        file_path.write_text(content)
        
        result = parse_index_md(file_path)
        
        assert "---" in result["body"]
        assert "Body with --- dashes" in result["body"]
    
    def test_handles_invalid_yaml_in_frontmatter(self, tmp_path: Path) -> None:
        """Returns empty frontmatter when YAML is malformed."""
        file_path = tmp_path / "invalid-yaml.md"
        content = """---
title: Invalid
{bad yaml: [unclosed
---

Body."""
        file_path.write_text(content)
        
        result = parse_index_md(file_path)
        
        # Should return empty frontmatter on parse error
        assert result["frontmatter"] == {}
        assert result["body"] == "Body."
    
    def test_parses_frontmatter_with_colons_in_values(self, tmp_path: Path) -> None:
        """Parses frontmatter with colons in values."""
        file_path = tmp_path / "colons.md"
        content = """---
title: "Page: With Colon"
url: "https://example.com:8080/path"
---

Body."""
        file_path.write_text(content)
        
        result = parse_index_md(file_path)
        
        assert result["frontmatter"]["title"] == "Page: With Colon"
        assert result["frontmatter"]["url"] == "https://example.com:8080/path"
    
    def test_handles_empty_file(self, tmp_path: Path) -> None:
        """Handles empty file."""
        file_path = tmp_path / "empty.md"
        file_path.touch()
        
        result = parse_index_md(file_path)
        
        assert result["frontmatter"] == {}
        assert result["body"] == ""
    
    def test_handles_file_with_only_frontmatter(self, tmp_path: Path) -> None:
        """Handles file with frontmatter but no body."""
        file_path = tmp_path / "only-fm.md"
        content = """---
title: Only Frontmatter
---"""
        file_path.write_text(content)
        
        result = parse_index_md(file_path)
        
        assert result["frontmatter"]["title"] == "Only Frontmatter"
        assert result["body"] == ""
    
    def test_returns_dict_with_required_keys(self, tmp_path: Path) -> None:
        """Always returns dict with 'frontmatter' and 'body' keys."""
        file_path = tmp_path / "test.md"
        file_path.write_text("Simple content")
        
        result = parse_index_md(file_path)
        
        assert "frontmatter" in result
        assert "body" in result
        assert isinstance(result["frontmatter"], dict)
        assert isinstance(result["body"], str)
    
    def test_parses_boolean_values(self, tmp_path: Path) -> None:
        """Parses boolean values in frontmatter."""
        file_path = tmp_path / "bools.md"
        content = """---
published: true
draft: false
---

Body."""
        file_path.write_text(content)
        
        result = parse_index_md(file_path)
        
        assert result["frontmatter"]["published"] is True
        assert result["frontmatter"]["draft"] is False
    
    def test_parses_null_values(self, tmp_path: Path) -> None:
        """Parses null values in frontmatter."""
        file_path = tmp_path / "nulls.md"
        content = """---
author: null
date: ~
---

Body."""
        file_path.write_text(content)
        
        result = parse_index_md(file_path)
        
        assert result["frontmatter"]["author"] is None
        assert result["frontmatter"]["date"] is None
    
    def test_preserves_body_formatting(self, tmp_path: Path) -> None:
        """Preserves markdown formatting in body."""
        file_path = tmp_path / "formatted.md"
        content = """---
title: Test
---

# Heading 1

## Heading 2

- List item 1
- List item 2

**Bold text** and *italic text*."""
        file_path.write_text(content)
        
        result = parse_index_md(file_path)
        
        assert "# Heading 1" in result["body"]
        assert "## Heading 2" in result["body"]
        assert "- List item 1" in result["body"]
        assert "**Bold text**" in result["body"]
    
    def test_handles_unicode_in_frontmatter(self, tmp_path: Path) -> None:
        """Handles Unicode characters in frontmatter."""
        file_path = tmp_path / "unicode.md"
        content = """---
title: "Test 世界 🌍"
author: "José García"
---

Body."""
        file_path.write_text(content, encoding="utf-8")
        
        result = parse_index_md(file_path)
        
        assert result["frontmatter"]["title"] == "Test 世界 🌍"
        assert result["frontmatter"]["author"] == "José García"
    
    def test_handles_unicode_in_body(self, tmp_path: Path) -> None:
        """Handles Unicode characters in body."""
        file_path = tmp_path / "unicode-body.md"
        content = """---
title: Test
---

Unicode in body: 世界 🌍 Ñoño"""
        file_path.write_text(content, encoding="utf-8")
        
        result = parse_index_md(file_path)
        
        assert "世界 🌍" in result["body"]
        assert "Ñoño" in result["body"]
    
    def test_handles_multiline_string_values(self, tmp_path: Path) -> None:
        """Handles multiline string values in frontmatter."""
        file_path = tmp_path / "multiline.md"
        content = """---
title: Test
description: |
  This is a multiline
  description that spans
  multiple lines.
---

Body."""
        file_path.write_text(content)
        
        result = parse_index_md(file_path)
        
        assert "multiline" in result["frontmatter"]["description"]
        assert "multiple lines" in result["frontmatter"]["description"]
    
    def test_frontmatter_starting_mid_line_not_parsed(self, tmp_path: Path) -> None:
        """Frontmatter must start at beginning of file to be parsed."""
        file_path = tmp_path / "mid-line.md"
        content = """Some text before
---
title: Not Frontmatter
---

Body."""
        file_path.write_text(content)
        
        result = parse_index_md(file_path)
        
        # Should not parse as frontmatter since --- is not at start
        assert result["frontmatter"] == {}
        assert result["body"] == content
