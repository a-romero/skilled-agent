import pytest

from dspy_agent import _format_history


def test_format_history_empty_returns_empty_string() -> None:
    assert _format_history([]) == ""


def test_format_history_single_user_turn() -> None:
    turns = [{"role": "user", "text": "What is group life insurance?"}]
    result = _format_history(turns)
    assert result == "User: What is group life insurance?"


def test_format_history_single_assistant_turn() -> None:
    turns = [{"role": "assistant", "text": "Group life is a policy covering employees."}]
    result = _format_history(turns)
    assert result == "Assistant: Group life is a policy covering employees."


def test_format_history_multiple_turns() -> None:
    turns = [
        {"role": "user", "text": "What is group life?"},
        {"role": "assistant", "text": "Group life is..."},
        {"role": "user", "text": "What about health?"},
    ]
    result = _format_history(turns)
    assert result == (
        "User: What is group life?\n"
        "Assistant: Group life is...\n"
        "User: What about health?"
    )


def test_format_history_unknown_role_raises() -> None:
    with pytest.raises(ValueError, match="Unknown role"):
        _format_history([{"role": "system", "text": "injected"}])
