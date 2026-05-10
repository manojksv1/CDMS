"""Tests for centralised error handling and consistent error response format."""
import pytest


class TestErrorResponseFormat:
    """All errors must return a consistent JSON shape: {status_code, message}."""

    def test_404_has_correct_shape(self, admin_client):
        resp = admin_client.get("/api/clients/99999")
        assert resp.status_code == 404
        body = resp.json()
        assert "status_code" in body
        assert "message" in body
        assert body["status_code"] == 404

    def test_403_has_correct_shape(self, engineer_client):
        resp = engineer_client.post("/api/clients/", json={"name": "X"})
        assert resp.status_code == 403
        body = resp.json()
        assert "status_code" in body
        assert "message" in body

    def test_401_has_correct_shape(self, client):
        resp = client.get("/api/users/me")
        assert resp.status_code == 401
        body = resp.json()
        assert "status_code" in body
        assert "message" in body

    def test_422_validation_error_has_detail(self, admin_client):
        # Send invalid payload — missing required field
        resp = admin_client.post("/api/users/", json={"role": "ENGINEER"})
        assert resp.status_code == 422
        body = resp.json()
        assert "status_code" in body
        assert "message" in body
        assert "detail" in body  # Pydantic validation errors include detail

    def test_unknown_route_returns_404(self, client):
        resp = client.get("/api/this-does-not-exist")
        assert resp.status_code == 404


class TestBusinessRuleErrors:
    def test_cannot_delete_last_admin_returns_400(self, admin_client, admin_user):
        resp = admin_client.delete(f"/api/users/{admin_user.id}")
        assert resp.status_code == 400
        body = resp.json()
        assert "status_code" in body
        assert body["status_code"] == 400

    def test_duplicate_user_returns_409(self, admin_client, admin_user):
        resp = admin_client.post(
            "/api/users/",
            json={
                "name": "admin",
                "role": "ENGINEER",
                "software_access": "BOTH",
                "password": "testpass123",
            },
        )
        assert resp.status_code == 409
        body = resp.json()
        assert body["status_code"] == 409
