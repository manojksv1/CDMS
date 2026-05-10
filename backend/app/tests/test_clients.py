"""Tests for client management endpoints."""
import pytest
from app.models.user import UserRole
from app.tests.conftest import _create_user, _login


def _create_client(client_fixture, name="Acme Corp"):
    resp = client_fixture.post("/api/clients/", json={"name": name})
    assert resp.status_code == 200, resp.text
    return resp.json()


class TestCreateClient:
    def test_admin_can_create_client(self, admin_client):
        data = _create_client(admin_client)
        assert data["name"] == "Acme Corp"
        assert data["id"] is not None

    def test_engineer_cannot_create_client(self, engineer_client):
        resp = engineer_client.post("/api/clients/", json={"name": "Hack Corp"})
        assert resp.status_code == 403

    def test_create_client_with_all_fields(self, admin_client):
        resp = admin_client.post(
            "/api/clients/",
            json={
                "name": "Full Client",
                "contact_info": "contact@full.com",
                "database_type": "PostgreSQL",
                "database_version": "15",
                "remarks": "VIP client",
                "tags": "enterprise,priority",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["database_type"] == "PostgreSQL"
        assert data["tags"] == "enterprise,priority"


class TestGetClients:
    def test_list_clients(self, admin_client):
        _create_client(admin_client, "Client A")
        _create_client(admin_client, "Client B")
        resp = admin_client.get("/api/clients/")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_get_single_client(self, admin_client):
        created = _create_client(admin_client)
        resp = admin_client.get(f"/api/clients/{created['id']}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Acme Corp"

    def test_get_nonexistent_client_returns_404(self, admin_client):
        resp = admin_client.get("/api/clients/99999")
        assert resp.status_code == 404


class TestUpdateClient:
    def test_admin_can_update_client(self, admin_client):
        created = _create_client(admin_client)
        resp = admin_client.patch(
            f"/api/clients/{created['id']}",
            json={"remarks": "Updated remarks"},
        )
        assert resp.status_code == 200
        assert resp.json()["remarks"] == "Updated remarks"

    def test_update_nonexistent_client_returns_404(self, admin_client):
        resp = admin_client.patch("/api/clients/99999", json={"name": "Ghost"})
        assert resp.status_code == 404

    def test_engineer_cannot_update_client(self, db, client, client2):
        # admin logs in on client, engineer on client2 — separate cookie jars
        _create_user(db, "admin2", UserRole.ADMIN)
        _create_user(db, "eng2", UserRole.ENGINEER)
        _login(client, "admin2")
        _login(client2, "eng2")
        created = client.post("/api/clients/", json={"name": "Target Corp"}).json()
        resp = client2.patch(f"/api/clients/{created['id']}", json={"remarks": "Hacked"})
        assert resp.status_code == 403


class TestDeleteClient:
    def test_admin_can_delete_client(self, admin_client):
        created = _create_client(admin_client)
        resp = admin_client.delete(f"/api/clients/{created['id']}")
        assert resp.status_code == 200

    def test_delete_nonexistent_client_returns_404(self, admin_client):
        resp = admin_client.delete("/api/clients/99999")
        assert resp.status_code == 404

    def test_engineer_cannot_delete_client(self, db, client, client2):
        _create_user(db, "admin3", UserRole.ADMIN)
        _create_user(db, "eng3", UserRole.ENGINEER)
        _login(client, "admin3")
        _login(client2, "eng3")
        created = client.post("/api/clients/", json={"name": "Delete Target"}).json()
        resp = client2.delete(f"/api/clients/{created['id']}")
        assert resp.status_code == 403
