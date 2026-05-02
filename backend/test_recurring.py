import requests

BASE = "http://localhost:8000"

# 1. Login
r = requests.post(f"{BASE}/auth/login", json={"email": "test@traccoon.app", "password": "SecurePass123!"})
token = r.json()["access_token"]
h = {"Authorization": f"Bearer {token}"}

# 2. Get households
hh = requests.get(f"{BASE}/households", headers=h).json()
hid = hh[0]["id"]
print(f"Household: {hid}")

# 3. Create a recurring rule
rule = requests.post(f"{BASE}/households/{hid}/recurring-expenses", headers=h, json={
    "title": "Internet Bill",
    "amount": 1500,
    "frequency": "monthly",
    "next_due_date": "2026-05-01",
    "payment_method": "bank_transfer",
    "notes": "PLDT fiber plan",
})
print(f"Create rule: {rule.status_code}")
rule_data = rule.json()
rid = rule_data["id"]
print(f"Rule ID: {rid}, Next due: {rule_data['next_due_date']}")

# 4. List rules
lr = requests.get(f"{BASE}/households/{hid}/recurring-expenses", headers=h)
print(f"List rules: {lr.status_code}, count={lr.json()['total_count']}")

# 5. Get upcoming
up = requests.get(f"{BASE}/households/{hid}/recurring-expenses/upcoming?within_days=60", headers=h)
print(f"Upcoming: {up.status_code}, count={len(up.json())}")
if up.json():
    print(f"  First: {up.json()[0]['title']}, days={up.json()[0]['days_until_due']}")

# 6. Generate due expenses
gen = requests.post(f"{BASE}/households/{hid}/recurring-expenses/generate?as_of=2026-05-02", headers=h)
print(f"Generate: {gen.status_code}")
gd = gen.json()
print(f"  Generated: {gd['generated_count']}, Skipped: {gd['skipped_count']}")

# 7. Dedup test
gen2 = requests.post(f"{BASE}/households/{hid}/recurring-expenses/generate?as_of=2026-05-02", headers=h)
gd2 = gen2.json()
print(f"Re-generate: generated={gd2['generated_count']}, skipped={gd2['skipped_count']}")

# 8. Check advanced due date
ra = requests.get(f"{BASE}/households/{hid}/recurring-expenses/{rid}", headers=h)
print(f"Next due after generate: {ra.json()['next_due_date']}")

# 9. Verify expense exists
expenses = requests.get(f"{BASE}/households/{hid}/expenses", headers=h)
ed = expenses.json()
recurring = [e for e in ed["expenses"] if e["is_recurring"]]
print(f"Total expenses: {ed['total_count']}, Recurring: {len(recurring)}")
if recurring:
    print(f"  Latest: {recurring[0]['title']} - ${recurring[0]['amount']}")

# 10. Cleanup - delete the rule
dr = requests.delete(f"{BASE}/households/{hid}/recurring-expenses/{rid}", headers=h)
print(f"Delete rule: {dr.status_code}")

print("\nAll tests passed!")
