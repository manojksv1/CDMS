import csv
import requests
from datetime import datetime, timedelta

API_URL = "http://localhost:8000/api"

# Login to get token
res = requests.post(f"{API_URL}/auth/login", data={"username": "admin", "password": "admin123"})
if res.status_code != 200:
    print("Login failed. Is the API running?")
    exit(1)
token = res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Cache for users to avoid duplicate API calls
users = {u["name"]: u["id"] for u in requests.get(f"{API_URL}/users/", headers=headers).json()}

def get_or_create_user(name):
    name = name.strip()
    if not name or name == "-------" or name == "-----------": 
        return None
    
    # Just take the first part if multiple POCs like "Akshay/Vikas"
    name = name.split('/')[0].strip()
    if not name: return None
    
    if name in users: 
        return users[name]
        
    res = requests.post(f"{API_URL}/users/", json={"name": name, "role": "Engineer", "password": "password123"}, headers=headers)
    if res.status_code == 200:
        uid = res.json()["id"]
        users[name] = uid
        return uid
    return None

def create_client(name, db_type, remarks):
    if not name: return None
    res = requests.post(f"{API_URL}/clients/", json={"name": name[:250], "database_type": db_type[:250], "remarks": remarks}, headers=headers)
    if res.status_code == 200:
        return res.json()["id"]
    return None

def create_location(name, client_id, hostname=None):
    if not client_id: return None
    res = requests.post(f"{API_URL}/locations/", json={"name": name[:250], "client_id": client_id, "hostname": hostname}, headers=headers)
    if res.status_code == 200:
        return res.json()["id"]
    return None

def create_task(name, location_id, assignee, status_text, due_date_str):
    if not location_id: return None
    
    status = "NOT_STARTED"
    if status_text:
        st_lower = status_text.lower()
        if "completed" in st_lower or "deployed" in st_lower or "done" in st_lower:
            status = "COMPLETED"
        elif "pending" in st_lower:
            status = "NOT_STARTED"

    # Simplistic date logic: we just assign a generic future date since CSV dates are heavily unstructured text
    due_date = "2026-12-31" 

    data = {
        "name": name,
        "due_date": due_date,
        "location_id": location_id
    }
    
    res = requests.post(f"{API_URL}/tasks/", json=data, headers=headers)
    if res.status_code == 200:
        task_id = res.json()["id"]
        
        # Assign if applicable
        if assignee:
            requests.patch(f"{API_URL}/tasks/{task_id}/assign", json={"assigned_to": assignee}, headers=headers)
            
        # Fast-forward status if COMPLETED
        if status == "COMPLETED":
            requests.patch(f"{API_URL}/tasks/{task_id}/status", json={"status": "IN_PROGRESS"}, headers=headers)
            requests.patch(f"{API_URL}/tasks/{task_id}/status", json={"status": "COMPLETED"}, headers=headers)
            
        return task_id
    return None

print("Starting to parse data.csv...")

ge_client_id = None

with open("data.csv", "r", encoding="utf-8", errors="ignore") as f:
    reader = csv.reader(f)
    mode = "main" # main, not_updated, poc, ge, middle_east
    
    for i, row in enumerate(reader):
        if len(row) < 2: continue
        
        # Check for section headers
        joined = ",".join(row).lower()
        if "not updated client list" in joined:
            mode = "not_updated"
            print("Switching to 'Not Updated' mode")
            continue
        if "poc-environments" in joined:
            mode = "poc"
            print("Switching to 'POC' mode")
            continue
        if "ge-21-locations" in joined or "wbsetcl main" in joined.lower():
            if not ge_client_id:
                ge_client_id = create_client("GE Vernova", "MS SQL", "21 Locations")
                print(f"Created main GE Vernova client with ID {ge_client_id}")
            mode = "ge"
            print("Switching to 'GE Locations' mode")
        if "middle east coustemer" in joined:
            mode = "middle_east"
            print("Switching to 'Middle East' mode")
            continue
            
        # We generally expect the first column to be an integer (S.No) for data rows
        is_data_row = row[0].strip().isdigit() or (mode == "main" and row[1] and row[1] != "Client Name" and row[0] == "")
        
        if not is_data_row and mode != "ge":
            continue
            
        try:
            if mode in ["main", "not_updated", "poc"]:
                if len(row) < 7: continue
                # Offset by 1 for some sections where row[0] is empty but row[1] is the number
                idx_offset = 1 if row[0] == "" and row[1].isdigit() else 0
                
                client_name = row[1+idx_offset].strip()
                if client_name == "Client Name" or not client_name: continue
                
                # Default values depending on length
                status = row[6+idx_offset].strip() if len(row) > 6+idx_offset else ""
                poc = row[7+idx_offset].strip() if len(row) > 7+idx_offset else ""
                db_type = row[8+idx_offset].strip() if len(row) > 8+idx_offset else ""
                remarks = row[9+idx_offset].strip() if len(row) > 9+idx_offset else ""
                
                user_id = get_or_create_user(poc)
                client_id = create_client(client_name, db_type, remarks)
                loc_id = create_location("Main Office", client_id)
                
                # UAT Task
                uat_date = row[2+idx_offset] if len(row) > 2+idx_offset else ""
                create_task("UAT Installation", loc_id, user_id, status, uat_date)
                
                # Prod Task
                prod_date = row[4+idx_offset] if len(row) > 4+idx_offset else ""
                create_task("Production Installation", loc_id, user_id, status, prod_date)
                
                print(f"Imported Client: {client_name}")
                
            elif mode == "ge":
                if not row[0].strip().isdigit(): continue
                loc_name = row[1].strip()
                hostname = row[2].strip() if len(row) > 2 else ""
                status = row[6].strip() if len(row) > 6 else ""
                poc = row[7].strip() if len(row) > 7 else ""
                
                user_id = get_or_create_user(poc)
                loc_id = create_location(loc_name, ge_client_id, hostname)
                create_task("Enhancement Deployment", loc_id, user_id, status, "2026-12-31")
                
                print(f"Imported GE Location: {loc_name}")
                
            elif mode == "middle_east":
                if not row[0].strip().isdigit(): continue
                if len(row) < 2: continue
                client_name = row[1].strip()
                poc = row[7].strip() if len(row) > 7 else ""
                remarks = row[9].strip() if len(row) > 9 else ""
                
                user_id = get_or_create_user(poc)
                client_id = create_client(client_name, "", remarks)
                loc_id = create_location("Main Office", client_id)
                create_task("Installation", loc_id, user_id, "Completed", "2025-12-31")
                
                print(f"Imported Middle East Client: {client_name}")
                
        except Exception as e:
            print(f"Warning: Error parsing row {i} - {row}. Error: {e}")

print("---------------------------------")
print("Data import complete!")
print("Please check the UI dashboard to see the loaded records.")
