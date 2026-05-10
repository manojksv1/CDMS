"""Tests for implementation tracker endpoints."""
import pytest
from datetime import date


def _create_impl(client, **kwargs):
    payload = {
        "company_name": "Test Corp",
        "status": "InProgress",
        **kwargs,
    }
    resp = client.post("/api/implementations/", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


class TestCreateImplementation:
    def test_create_basic_implementation(self, admin_client):
        data = _create_impl(admin_client)
        assert data["company_name"] == "Test Corp"
        assert data["status"] == "InProgress"
        assert data["current_percentage"] == 0.0

    def test_create_with_all_fields(self, admin_client):
        data = _create_impl(
            admin_client,
            company_name="Full Corp",
            poc_1="John Doe",
            uat_version="1.0",
            start_date=str(date.today()),
        )
        assert data["poc_1"] == "John Doe"
        assert data["uat_version"] == "1.0"


class TestGetImplementations:
    def test_list_implementations(self, admin_client):
        _create_impl(admin_client)
        _create_impl(admin_client, company_name="Second Corp")
        resp = admin_client.get("/api/implementations/")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_engineer_only_sees_assigned(self, admin_client, engineer_client, engineer_user):
        # Create one assigned, one not
        _create_impl(admin_client, assigned_user_id=engineer_user.id)
        _create_impl(admin_client, company_name="Unassigned Corp")

        resp = engineer_client.get("/api/implementations/")
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["company_name"] == "Test Corp"

    def test_get_implementation_detail(self, admin_client):
        created = _create_impl(admin_client)
        resp = admin_client.get(f"/api/implementations/{created['id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert "tasks" in data
        assert "logs" in data

    def test_get_nonexistent_returns_404(self, admin_client):
        resp = admin_client.get("/api/implementations/99999")
        assert resp.status_code == 404


class TestUpdateImplementation:
    def test_update_status(self, admin_client):
        created = _create_impl(admin_client)
        resp = admin_client.patch(
            f"/api/implementations/{created['id']}",
            json={"status": "OnHold", "status_remarks": "Waiting for client"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "OnHold"

    def test_update_nonexistent_returns_404(self, admin_client):
        resp = admin_client.patch(
            "/api/implementations/99999",
            json={"status": "OnHold"},
        )
        assert resp.status_code == 404


class TestImplementationLogs:
    def test_create_log(self, admin_client):
        created = _create_impl(admin_client)
        resp = admin_client.post(
            f"/api/implementations/{created['id']}/logs",
            json={"date": str(date.today()), "remarks": "Progress made today"},
        )
        assert resp.status_code == 201
        assert resp.json()["remarks"] == "Progress made today"

    def test_log_on_nonexistent_impl_returns_404(self, admin_client):
        resp = admin_client.post(
            "/api/implementations/99999/logs",
            json={"date": str(date.today()), "remarks": "Test"},
        )
        assert resp.status_code == 404


class TestBulkTaskUpdate:
    def test_bulk_update_requires_valid_schema(self, admin_client):
        # Sending raw list (old broken format) should now fail validation
        resp = admin_client.patch(
            "/api/implementations/tasks-bulk/update",
            json=[{"id": 1, "is_completed": True}],  # wrong — should be {"updates": [...]}
        )
        assert resp.status_code == 422

    def test_bulk_update_empty_list_fails(self, admin_client):
        resp = admin_client.patch(
            "/api/implementations/tasks-bulk/update",
            json={"updates": []},
        )
        assert resp.status_code == 422

    def test_bulk_update_valid_payload(self, admin_client):
        created = _create_impl(admin_client)
        detail = admin_client.get(f"/api/implementations/{created['id']}").json()
        tasks = detail.get("tasks", [])

        if not tasks:
            pytest.skip("No tasks seeded for this implementation")

        task_id = tasks[0]["id"]
        resp = admin_client.patch(
            "/api/implementations/tasks-bulk/update",
            json={"updates": [{"id": task_id, "is_completed": True}]},
        )
        assert resp.status_code == 200


class TestMilestoneTemplates:
    def test_engineer_cannot_create_template(self, engineer_client):
        resp = engineer_client.post(
            "/api/implementations/templates/",
            json={"task_name": "Hack", "weight": 5.0, "order": 0},
        )
        assert resp.status_code == 403

    def test_admin_can_create_section(self, admin_client):
        resp = admin_client.post(
            "/api/implementations/sections/",
            json={"name": "Test Section", "weight": 10.0, "order": 0},
        )
        assert resp.status_code == 201
        assert resp.json()["name"] == "Test Section"

    def test_delete_section_returns_204(self, admin_client):
        created = admin_client.post(
            "/api/implementations/sections/",
            json={"name": "To Delete", "weight": 5.0, "order": 0},
        ).json()
        resp = admin_client.delete(f"/api/implementations/sections/{created['id']}")
        assert resp.status_code == 204

    def test_delete_nonexistent_section_returns_404(self, admin_client):
        resp = admin_client.delete("/api/implementations/sections/99999")
        assert resp.status_code == 404
