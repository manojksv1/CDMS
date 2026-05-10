"""Tests for user management endpoints."""
import pytest


class TestCreateUser:
    def test_admin_can_create_user(self, admin_client):
        resp = admin_client.post(
            "/api/users/",
            json={
                "name": "newuser",
                "role": "ENGINEER",
                "software_access": "BOTH",
                "password": "securepassword123",
                "timezone": "UTC",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "newuser"
        assert data["role"] == "ENGINEER"
        assert "hashed_password" not in data

    def test_duplicate_username_returns_409(self, admin_client, admin_user):
        resp = admin_client.post(
            "/api/users/",
            json={
                "name": "admin",  # already exists
                "role": "ENGINEER",
                "software_access": "BOTH",
                "password": "securepassword123",
                "timezone": "UTC",
            },
        )
        assert resp.status_code == 409

    def test_non_admin_cannot_create_user(self, engineer_client):
        resp = engineer_client.post(
            "/api/users/",
            json={
                "name": "hacker",
                "role": "ADMIN",
                "software_access": "BOTH",
                "password": "securepassword123",
                "timezone": "UTC",
            },
        )
        assert resp.status_code == 403


class TestGetUsers:
    def test_get_users_returns_list(self, admin_client, admin_user):
        resp = admin_client.get("/api/users/")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        assert len(resp.json()) >= 1

    def test_get_me(self, admin_client):
        resp = admin_client.get("/api/users/me")
        assert resp.status_code == 200
        assert resp.json()["name"] == "admin"


class TestUpdateUser:
    def test_admin_can_update_user(self, admin_client, engineer_user):
        resp = admin_client.patch(
            f"/api/users/{engineer_user.id}",
            json={"timezone": "Asia/Kolkata"},
        )
        assert resp.status_code == 200
        assert resp.json()["timezone"] == "Asia/Kolkata"

    def test_cannot_demote_last_admin(self, admin_client, admin_user):
        resp = admin_client.patch(
            f"/api/users/{admin_user.id}",
            json={"role": "ENGINEER"},
        )
        assert resp.status_code == 400

    def test_non_admin_cannot_update_user(self, engineer_client, manager_user):
        resp = engineer_client.patch(
            f"/api/users/{manager_user.id}",
            json={"timezone": "UTC"},
        )
        assert resp.status_code == 403


class TestDeleteUser:
    def test_admin_can_delete_user(self, admin_client, engineer_user):
        resp = admin_client.delete(f"/api/users/{engineer_user.id}")
        assert resp.status_code == 200

    def test_cannot_delete_self(self, admin_client, admin_user):
        resp = admin_client.delete(f"/api/users/{admin_user.id}")
        assert resp.status_code == 400

    def test_cannot_delete_last_admin(self, admin_client, admin_user):
        resp = admin_client.delete(f"/api/users/{admin_user.id}")
        assert resp.status_code == 400

    def test_delete_nonexistent_user_returns_404(self, admin_client):
        resp = admin_client.delete("/api/users/99999")
        assert resp.status_code == 404


class TestPasswordReset:
    def test_user_can_reset_own_password(self, admin_client):
        resp = admin_client.post(
            "/api/users/reset-password",
            json={"new_password": "newstrongpassword123"},
        )
        assert resp.status_code == 200

    def test_logout_all_sessions(self, admin_client, engineer_user):
        resp = admin_client.post(f"/api/users/{engineer_user.id}/logout-all")
        assert resp.status_code == 200
        assert "invalidated" in resp.json()["message"]
