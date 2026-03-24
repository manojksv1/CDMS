import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000/api"
print("Starting API tests...")

# 1. Login
response = requests.post(f"{BASE_URL}/auth/login", data={"username": "admin", "password": "admin123"})
if response.status_code != 200:
    print("Login failed:", response.text)
    exit(1)

token = response.json().get("access_token")
headers = {"Authorization": f"Bearer {token}"}
print("1. Login Successful")

# 2. Get current user
response = requests.get(f"{BASE_URL}/users/me", headers=headers)
print("2. Current User:", response.json().get("name"))

# 3. Create a User (Engineer)
engineer_data = {"name": "TestEngineer", "role": "Engineer", "password": "password123"}
response = requests.post(f"{BASE_URL}/users/", json=engineer_data, headers=headers)
if response.status_code == 200:
    engineer_id = response.json().get("id")
    print("3. Created Engineer User with ID:", engineer_id)
else:
    print("3. Create User failed (might already exist):", response.text)
    # Fetch existing
    users = requests.get(f"{BASE_URL}/users/", headers=headers).json()
    engineer_id = next(u["id"] for u in users if u["name"] == "TestEngineer")

# 4. Create Client
client_data = {"name": "Test Client", "contact_info": "test@example.com", "database_type": "MySQL"}
response = requests.post(f"{BASE_URL}/clients/", json=client_data, headers=headers)
client_id = response.json().get("id")
print("4. Created Client with ID:", client_id)

# 5. Create Location
loc_data = {"name": "Main Office", "client_id": client_id, "hostname": "srv1.example.com"}
response = requests.post(f"{BASE_URL}/locations/", json=loc_data, headers=headers)
loc_id = response.json().get("id")
print("5. Created Location with ID:", loc_id)

# 6. Create Task 1 (Dependency)
due_date = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
task1_data = {"name": "Setup DB", "due_date": due_date, "location_id": loc_id}
response = requests.post(f"{BASE_URL}/tasks/", json=task1_data, headers=headers)
task1_id = response.json().get("id")
print("6. Created Task 1 with ID:", task1_id)

# 7. Create Task 2 (Dependent on Task 1)
task2_data = {"name": "Install Software", "due_date": due_date, "location_id": loc_id, "dependency_task_id": task1_id}
response = requests.post(f"{BASE_URL}/tasks/", json=task2_data, headers=headers)
task2_id = response.json().get("id")
print("7. Created Task 2 (dependent) with ID:", task2_id)

# 8. Assign Task 1 to Engineer
response = requests.patch(f"{BASE_URL}/tasks/{task1_id}/assign", json={"assigned_to": engineer_id}, headers=headers)
print("8. Assigned Task 1 to Engineer:", response.status_code == 200)

# 9. Try to start Task 2 (should fail because Task 1 is not completed)
response = requests.patch(f"{BASE_URL}/tasks/{task2_id}/status", json={"status": "IN_PROGRESS"}, headers=headers)
print("9. Try start Task 2 without dependency complete (Expect 400):", response.status_code, response.json().get("detail"))

# 10. Start and Complete Task 1
requests.patch(f"{BASE_URL}/tasks/{task1_id}/status", json={"status": "IN_PROGRESS"}, headers=headers)
response = requests.patch(f"{BASE_URL}/tasks/{task1_id}/status", json={"status": "COMPLETED"}, headers=headers)
print("10. Completed Task 1:", response.status_code == 200)

# 11. Start Task 2 (should succeed now)
response = requests.patch(f"{BASE_URL}/tasks/{task2_id}/status", json={"status": "IN_PROGRESS"}, headers=headers)
print("11. Start Task 2 (Expect 200):", response.status_code == 200)

# 12. Dashboard Summary
response = requests.get(f"{BASE_URL}/dashboard/summary", headers=headers)
print("12. Dashboard Summary:", json.dumps(response.json(), indent=2))

print("All API tests completed.")
