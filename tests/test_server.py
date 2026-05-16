from fastapi.testclient import TestClient
from server import app

client = TestClient(app)


def test_skills_endpoint_returns_200() -> None:
    resp = client.get("/api/skills")
    assert resp.status_code == 200


def test_skills_endpoint_returns_list() -> None:
    resp = client.get("/api/skills")
    data = resp.json()
    assert isinstance(data, list)


def test_skills_endpoint_items_have_name_and_description() -> None:
    resp = client.get("/api/skills")
    data = resp.json()
    for item in data:
        assert "name" in item
        assert "description" in item


def test_skills_endpoint_returns_known_skills() -> None:
    """Skills directory has python-coder and summariser."""
    resp = client.get("/api/skills")
    names = {s["name"] for s in resp.json()}
    assert "python-coder" in names
    assert "summariser" in names


from unittest.mock import MagicMock, patch


def test_chat_accepts_history_field() -> None:
    """POST /api/chat with a history list returns 200."""
    with patch("dspy_agent.run_agent", return_value="Test answer."):
        resp = client.post("/api/chat", json={
            "question": "follow-up question",
            "history": [
                {"role": "user", "text": "first question"},
                {"role": "assistant", "text": "first answer"},
            ],
        })
    assert resp.status_code == 200


def test_chat_backward_compatible_without_history() -> None:
    """POST /api/chat without history field still returns 200."""
    with patch("dspy_agent.run_agent", return_value="Test answer."):
        resp = client.post("/api/chat", json={"question": "standalone question"})
    assert resp.status_code == 200


def test_chat_passes_history_to_run_agent() -> None:
    """Server passes the received history to run_agent."""
    mock_run = MagicMock(return_value="Answer.")
    with patch("dspy_agent.run_agent", mock_run):
        client.post("/api/chat", json={
            "question": "follow-up",
            "history": [
                {"role": "user", "text": "Q1"},
                {"role": "assistant", "text": "A1"},
            ],
        })
    mock_run.assert_called_once()
    kwargs = mock_run.call_args.kwargs
    assert kwargs["history"] == [
        {"role": "user", "text": "Q1"},
        {"role": "assistant", "text": "A1"},
    ]


def test_chat_caps_history_at_six_turns() -> None:
    """Server discards turns beyond the last 6 before calling run_agent."""
    mock_run = MagicMock(return_value="Answer.")
    long_history = [
        {"role": "user" if i % 2 == 0 else "assistant", "text": f"turn {i}"}
        for i in range(10)
    ]
    with patch("dspy_agent.run_agent", mock_run):
        client.post("/api/chat", json={"question": "q", "history": long_history})
    kwargs = mock_run.call_args.kwargs
    assert len(kwargs["history"]) == 6
    assert kwargs["history"] == long_history[-6:]
