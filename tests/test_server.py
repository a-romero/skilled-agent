import pytest
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
