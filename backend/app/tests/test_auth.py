"""Tests for authentication endpoints."""
import pytest
from fastapi.testclient import TestClient


class TestLogin:
    def test_login_success(self, client, admin_user):
        resp = client.post(
            "/api/auth/login",
            data={"username": "admin", "password": "testpass123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "admin"
        assert data["role"] == "ADMIN"
        # Token must be in HttpOnly cookie, NOT in response body
        assert "access_token" not in data
        assert "access_token" in resp.cookies

    def test_login_wrong_password(self, client, admin_user):
        resp = client.post(
            "/api/auth/login",
            data={"username": "admin", "password": "wrongpassword"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert resp.status_code == 401
        assert "access_token" not in resp.cookies

    def test_login_unknown_user(self, client):
        resp = client.post(
            "/api/auth/login",
            data={"username": "nobody", "password": "testpass123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert resp.status_code == 401

    def test_login_sets_refresh_cookie(self, client, admin_user):
        resp = client.post(
            "/api/auth/login",
            data={"username": "admin", "password": "testpass123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert resp.status_code == 200
        assert "refresh_token" in resp.cookies


class TestLogout:
    def test_logout_clears_cookies(self, admin_client):
        resp = admin_client.post("/api/auth/logout")
        assert resp.status_code == 200
        # Cookies should be cleared (empty value or absent)
        assert resp.cookies.get("access_token", "") == ""

    def test_logout_unauthenticated_still_succeeds(self, client):
        # Logout should not require auth — just clears cookies
        resp = client.post("/api/auth/logout")
        assert resp.status_code == 200


class TestRefresh:
    def test_refresh_returns_new_access_token(self, admin_client):
        resp = admin_client.post("/api/auth/refresh")
        assert resp.status_code == 200
        assert "access_token" in admin_client.cookies

    def test_refresh_without_cookie_returns_401(self, client):
        resp = client.post("/api/auth/refresh")
        assert resp.status_code == 401


class TestProtectedRoute:
    def test_unauthenticated_request_returns_401(self, client):
        resp = client.get("/api/users/me")
        assert resp.status_code == 401

    def test_authenticated_request_succeeds(self, admin_client):
        resp = admin_client.get("/api/users/me")
        assert resp.status_code == 200
        assert resp.json()["name"] == "admin"
