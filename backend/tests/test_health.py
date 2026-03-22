"""Tests for the FastAPI health endpoint and basic app setup."""

import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """Create a test client with mocked external services."""
    with patch("app.services.embeddings.get_embedding", new_callable=AsyncMock, return_value=[0.1] * 1024):
        from app.main import app
        return TestClient(app)


def test_health_endpoint(client):
    """Health check should return 200 with status ok."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_app_includes_telegram_router(client):
    """Verify the telegram router is mounted."""
    # The webhook endpoint should exist (even if it rejects unauthenticated requests)
    response = client.post("/api/telegram/webhook", json={})
    # Should get 401 or 500 (missing secret), not 404
    assert response.status_code != 404


def test_app_includes_dashboard_router(client):
    """Verify the dashboard router is mounted."""
    # Any dashboard route should not 404
    response = client.get("/api/dashboard/conversations/fake-user-id")
    # Should get 401 (no auth header), not 404
    assert response.status_code in (401, 403, 500)
