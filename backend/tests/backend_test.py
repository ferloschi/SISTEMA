"""Backend tests for Dra. Brinquinho API.
Covers: Products, Patients, Appointments, Payment Methods, Sales, Dashboard,
Reminders and Monthly Reports.
"""
import os
from datetime import date, datetime, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://dra-brinquinho-app.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Health / Root ----------
class TestHealth:
    def test_root(self, client):
        r = client.get(f"{API}/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"


# ---------- Payment Methods ----------
class TestPaymentMethods:
    def test_defaults_exist(self, client):
        r = client.get(f"{API}/payment-methods")
        assert r.status_code == 200
        items = r.json()
        names = {i["name"]: i for i in items}
        # Must have the 4 defaults
        for n in ["Dinheiro", "PIX", "Cartão Débito", "Cartão Crédito"]:
            assert n in names, f"Missing default payment method: {n}"
        assert names["Cartão Débito"]["card_fee_pct"] == 1.99
        assert names["Cartão Débito"]["is_card"] is True
        assert names["Cartão Crédito"]["card_fee_pct"] == 3.99
        assert names["Cartão Crédito"]["is_card"] is True
        assert names["PIX"]["card_fee_pct"] == 0.0
        assert names["PIX"]["is_card"] is False

    def test_crud(self, client):
        # Create
        payload = {"name": "TEST_PM", "card_fee_pct": 2.5, "is_card": True, "active": True}
        r = client.post(f"{API}/payment-methods", json=payload)
        assert r.status_code == 200
        pm = r.json()
        pm_id = pm["id"]
        assert pm["name"] == "TEST_PM"
        assert pm["card_fee_pct"] == 2.5

        # Update
        upd = {"name": "TEST_PM_UPD", "card_fee_pct": 3.0, "is_card": True, "active": False}
        r = client.put(f"{API}/payment-methods/{pm_id}", json=upd)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_PM_UPD"
        assert r.json()["card_fee_pct"] == 3.0

        # Verify via list
        items = client.get(f"{API}/payment-methods").json()
        found = next((i for i in items if i["id"] == pm_id), None)
        assert found is not None and found["name"] == "TEST_PM_UPD"

        # Delete
        r = client.delete(f"{API}/payment-methods/{pm_id}")
        assert r.status_code == 200

        # 404 after delete
        r = client.put(f"{API}/payment-methods/{pm_id}", json=upd)
        assert r.status_code == 404


# ---------- Products / Estoque ----------
class TestProducts:
    created_ids = []

    def test_create_with_auto_sku(self, client):
        payload = {
            "name": "TEST_Brinco Ouro",
            "category": "Brinco",
            "material": "Ouro",
            "purchase_value": 50.0,
            "sale_value": 150.0,
            "stock_qty": 10,
            "min_stock": 2,
        }
        r = client.post(f"{API}/products", json=payload)
        assert r.status_code == 200
        prod = r.json()
        assert prod["sku"].startswith("SKU")
        assert prod["name"] == "TEST_Brinco Ouro"
        assert prod["stock_qty"] == 10
        TestProducts.created_ids.append(prod["id"])

    def test_create_with_explicit_sku(self, client):
        payload = {"sku": "TEST_SKU_001", "name": "TEST_Material X", "stock_qty": 5, "sale_value": 20.0, "purchase_value": 5.0}
        r = client.post(f"{API}/products", json=payload)
        assert r.status_code == 200
        assert r.json()["sku"] == "TEST_SKU_001"
        TestProducts.created_ids.append(r.json()["id"])

    def test_list_and_search(self, client):
        r = client.get(f"{API}/products")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        # Search
        r = client.get(f"{API}/products", params={"q": "TEST_Brinco"})
        assert r.status_code == 200
        assert any("TEST_Brinco" in p["name"] for p in r.json())

    def test_update_product(self, client):
        pid = TestProducts.created_ids[0]
        payload = {
            "name": "TEST_Brinco Ouro Updated",
            "category": "Brinco",
            "purchase_value": 60.0,
            "sale_value": 180.0,
            "stock_qty": 15,
            "min_stock": 3,
        }
        r = client.put(f"{API}/products/{pid}", json=payload)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Brinco Ouro Updated"
        assert r.json()["stock_qty"] == 15

    def test_update_404(self, client):
        r = client.put(f"{API}/products/nonexistent-id", json={"name": "X"})
        assert r.status_code == 404

    def test_delete_404(self, client):
        r = client.delete(f"{API}/products/nonexistent-id")
        assert r.status_code == 404


# ---------- Patients ----------
class TestPatients:
    created_id = None

    def test_create(self, client):
        payload = {
            "parent_name": "TEST_Maria Silva",
            "child_name": "TEST_Ana",
            "phone": "11999998888",
            "email": "test@example.com",
            "birth_date": "2020-05-10",
        }
        r = client.post(f"{API}/patients", json=payload)
        assert r.status_code == 200
        pt = r.json()
        assert pt["parent_name"] == "TEST_Maria Silva"
        assert pt["child_name"] == "TEST_Ana"
        TestPatients.created_id = pt["id"]

    def test_list_and_search(self, client):
        r = client.get(f"{API}/patients", params={"q": "TEST_Maria"})
        assert r.status_code == 200
        assert any(p["id"] == TestPatients.created_id for p in r.json())

    def test_update(self, client):
        r = client.put(f"{API}/patients/{TestPatients.created_id}", json={
            "parent_name": "TEST_Maria Silva Updated",
            "child_name": "TEST_Ana",
            "phone": "11111111111",
        })
        assert r.status_code == 200
        assert r.json()["parent_name"] == "TEST_Maria Silva Updated"

    def test_update_404(self, client):
        r = client.put(f"{API}/patients/nonexistent", json={"parent_name": "X"})
        assert r.status_code == 404


# ---------- Appointments ----------
class TestAppointments:
    appt_id = None
    appt_date = (date.today() + timedelta(days=2)).isoformat()

    def test_create_post_sale_date_plus_45(self, client):
        payload = {
            "patient_name": "TEST_Maria Silva",
            "child_name": "TEST_Ana",
            "procedure_type": "perfuração baby",
            "date": TestAppointments.appt_date,
            "time": "10:00",
        }
        r = client.post(f"{API}/appointments", json=payload)
        assert r.status_code == 200
        a = r.json()
        expected = (datetime.strptime(TestAppointments.appt_date, "%Y-%m-%d").date() + timedelta(days=45)).isoformat()
        assert a["post_sale_date"] == expected, f"Expected {expected}, got {a['post_sale_date']}"
        assert a["status"] == "agendado"
        assert a["reminder_status"] == "pendente"
        TestAppointments.appt_id = a["id"]

    def test_list_with_date_filter(self, client):
        r = client.get(f"{API}/appointments", params={"date_from": TestAppointments.appt_date, "date_to": TestAppointments.appt_date})
        assert r.status_code == 200
        assert any(a["id"] == TestAppointments.appt_id for a in r.json())

    def test_update_recomputes_post_sale(self, client):
        new_date = (date.today() + timedelta(days=5)).isoformat()
        payload = {
            "patient_name": "TEST_Maria Silva",
            "procedure_type": "piercing",
            "date": new_date,
            "time": "11:30",
            "status": "agendado",
        }
        r = client.put(f"{API}/appointments/{TestAppointments.appt_id}", json=payload)
        assert r.status_code == 200
        expected = (datetime.strptime(new_date, "%Y-%m-%d").date() + timedelta(days=45)).isoformat()
        assert r.json()["post_sale_date"] == expected

    def test_mark_reminder_sent(self, client):
        r = client.post(f"{API}/appointments/{TestAppointments.appt_id}/mark-reminder-sent")
        assert r.status_code == 200
        # Verify
        appts = client.get(f"{API}/appointments").json()
        a = next(x for x in appts if x["id"] == TestAppointments.appt_id)
        assert a["reminder_status"] == "enviado"


# ---------- Reminders pending ----------
class TestReminders:
    def test_pending_in_window(self, client):
        # Create an appointment whose post_sale_date falls in -7 .. +14 day window
        # post_sale_date = appointment date + 45 days. To land within +14d window,
        # appointment date should be ~today - 30d
        # post_sale_date = appt_date + 45 must fall within today-7 .. today+14
        appt_date = (date.today() - timedelta(days=40)).isoformat()
        payload = {
            "patient_name": "TEST_Reminder",
            "procedure_type": "lobuloplastia",
            "date": appt_date,
            "time": "09:00",
        }
        r = client.post(f"{API}/appointments", json=payload)
        assert r.status_code == 200
        appt_id = r.json()["id"]

        r = client.get(f"{API}/reminders/pending")
        assert r.status_code == 200
        ids = [a["id"] for a in r.json()]
        assert appt_id in ids, "Newly-created appointment with post_sale_date in window should appear"

        # Cleanup
        client.delete(f"{API}/appointments/{appt_id}")


# ---------- Sales ----------
class TestSales:
    sale_id = None

    @pytest.fixture(scope="class")
    def pix_pm(self, client):
        items = client.get(f"{API}/payment-methods").json()
        return next(p for p in items if p["name"] == "PIX")

    @pytest.fixture(scope="class")
    def credito_pm(self, client):
        items = client.get(f"{API}/payment-methods").json()
        return next(p for p in items if p["name"] == "Cartão Crédito")

    @pytest.fixture(scope="class")
    def product(self, client):
        # Create dedicated product for sale flow
        r = client.post(f"{API}/products", json={
            "name": "TEST_SaleProduct",
            "sale_value": 100.0,
            "purchase_value": 30.0,
            "stock_qty": 20,
            "min_stock": 1,
        })
        return r.json()

    def test_invalid_payment_method(self, client):
        r = client.post(f"{API}/sales", json={
            "sale_date": date.today().isoformat(),
            "payment_method_id": "invalid-id",
            "items": [],
        })
        assert r.status_code == 400

    def test_create_pix_sale_no_fee(self, client, pix_pm, product):
        today = date.today().isoformat()
        payload = {
            "sale_date": today,
            "patient_name": "TEST_Cliente",
            "payment_method_id": pix_pm["id"],
            "items": [
                {"product_id": product["id"], "name": product["name"], "qty": 2, "unit_price": 100.0, "unit_cost": 30.0}
            ],
        }
        r = client.post(f"{API}/sales", json=payload)
        assert r.status_code == 200
        s = r.json()
        assert s["gross_value"] == 200.0
        assert s["total_cost"] == 60.0
        assert s["fee_amount"] == 0.0
        assert s["card_fee_pct"] == 0.0
        assert s["profit"] == 140.0  # 200 - 60 - 0
        expected_post = (datetime.strptime(today, "%Y-%m-%d").date() + timedelta(days=45)).isoformat()
        assert s["post_sale_date"] == expected_post
        # PIX is not card -> receive_date == sale_date
        assert s["receive_date"] == today

        # Stock decremented
        prod = next(p for p in client.get(f"{API}/products").json() if p["id"] == product["id"])
        assert prod["stock_qty"] == 18  # 20 - 2

        # Delete and verify stock restored
        r = client.delete(f"{API}/sales/{s['id']}")
        assert r.status_code == 200
        prod = next(p for p in client.get(f"{API}/products").json() if p["id"] == product["id"])
        assert prod["stock_qty"] == 20

    def test_create_credit_card_sale_with_fee(self, client, credito_pm, product):
        today = date.today().isoformat()
        payload = {
            "sale_date": today,
            "payment_method_id": credito_pm["id"],
            "items": [
                {"product_id": product["id"], "name": product["name"], "qty": 1, "unit_price": 100.0, "unit_cost": 30.0}
            ],
        }
        r = client.post(f"{API}/sales", json=payload)
        assert r.status_code == 200
        s = r.json()
        assert s["gross_value"] == 100.0
        assert s["card_fee_pct"] == 3.99
        assert s["fee_amount"] == 3.99  # 100 * 3.99%
        assert s["net_value"] == 96.01
        assert s["profit"] == 66.01  # 100 - 30 - 3.99
        # Card -> receive_date = sale_date + 30 days
        expected_recv = (datetime.strptime(today, "%Y-%m-%d").date() + timedelta(days=30)).isoformat()
        assert s["receive_date"] == expected_recv
        TestSales.sale_id = s["id"]

    def test_list_sales_filter_by_month(self, client):
        month = date.today().strftime("%Y-%m")
        r = client.get(f"{API}/sales", params={"month": month})
        assert r.status_code == 200
        ids = [x["id"] for x in r.json()]
        assert TestSales.sale_id in ids
        # All returned sales should match the month
        for s in r.json():
            assert s["sale_date"].startswith(month)

        # Different month -> should not include
        other = "2000-01"
        r = client.get(f"{API}/sales", params={"month": other})
        assert r.status_code == 200
        assert TestSales.sale_id not in [x["id"] for x in r.json()]

    def test_delete_sale_restores_stock(self, client, product):
        # Sale was 1 unit; before delete:
        prod_before = next(p for p in client.get(f"{API}/products").json() if p["id"] == product["id"])
        r = client.delete(f"{API}/sales/{TestSales.sale_id}")
        assert r.status_code == 200
        prod_after = next(p for p in client.get(f"{API}/products").json() if p["id"] == product["id"])
        assert prod_after["stock_qty"] == prod_before["stock_qty"] + 1

    def test_delete_sale_404(self, client):
        r = client.delete(f"{API}/sales/nonexistent")
        assert r.status_code == 404


# ---------- Dashboard ----------
class TestDashboard:
    def test_dashboard_structure(self, client):
        r = client.get(f"{API}/dashboard")
        assert r.status_code == 200
        d = r.json()
        for key in [
            "today", "month", "today_appointments", "month_gross", "month_profit",
            "month_fees", "month_cost", "sales_count", "pending_reminders",
            "low_stock_count", "chart_daily", "chart_payment_methods"
        ]:
            assert key in d, f"Missing key {key} in dashboard response"
        assert isinstance(d["chart_daily"], list)
        assert isinstance(d["chart_payment_methods"], list)


# ---------- Monthly reports ----------
class TestReports:
    def test_monthly_aggregation(self, client):
        # Create a sale to ensure something to aggregate
        pms = client.get(f"{API}/payment-methods").json()
        pix = next(p for p in pms if p["name"] == "PIX")
        today = date.today().isoformat()
        r = client.post(f"{API}/sales", json={
            "sale_date": today,
            "payment_method_id": pix["id"],
            "items": [{"name": "TEST_Servico", "qty": 1, "unit_price": 50.0, "unit_cost": 10.0}],
        })
        assert r.status_code == 200
        sale_id = r.json()["id"]

        year = int(today[:4])
        r = client.get(f"{API}/reports/monthly", params={"year": year})
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        cur_month = today[:7]
        row = next((x for x in rows if x["month"] == cur_month), None)
        assert row is not None
        assert row["gross"] >= 50.0
        assert row["count"] >= 1
        for f in ["gross", "cost", "fees", "profit", "count"]:
            assert f in row

        # Cleanup
        client.delete(f"{API}/sales/{sale_id}")

    def test_monthly_requires_year(self, client):
        r = client.get(f"{API}/reports/monthly")
        # Query year is required
        assert r.status_code in (400, 422)


# ---------- Procedures (Precificação) ----------
class TestProcedures:
    proc_id = None

    def test_create_procedure_with_calculations(self, client):
        # items_cost = 2*10 + 1*5 + 3*2 = 31
        # indirect_value = 31 * 20 / 100 = 6.2
        # total_cost = 37.2
        # margin_value = 37.2 * 100 / 100 = 37.2
        # suggested_price = 74.4
        # final_price = 74.4 (manual_price = 0)
        payload = {
            "name": "TEST_Perfuracao_Premium",
            "description": "TEST procedure",
            "items": [
                {"name": "Joia Ouro", "qty": 2, "unit_cost": 10.0},
                {"name": "Algodao", "qty": 1, "unit_cost": 5.0},
                {"name": "Agulha", "qty": 3, "unit_cost": 2.0},
            ],
            "indirect_cost_pct": 20.0,
            "margin_pct": 100.0,
            "manual_price": 0.0,
        }
        r = client.post(f"{API}/procedures", json=payload)
        assert r.status_code == 200, r.text
        p = r.json()
        # No _id leakage
        assert "_id" not in p
        assert p["name"] == "TEST_Perfuracao_Premium"
        assert p["items_cost"] == 31.0
        assert p["indirect_value"] == 6.2
        assert p["total_cost"] == 37.2
        assert p["margin_value"] == 37.2
        assert p["suggested_price"] == 74.4
        assert p["final_price"] == 74.4
        TestProcedures.proc_id = p["id"]

    def test_manual_price_overrides_suggested(self, client):
        payload = {
            "name": "TEST_Manual_Override",
            "items": [{"name": "Joia", "qty": 1, "unit_cost": 50.0}],
            "indirect_cost_pct": 10.0,
            "margin_pct": 50.0,
            "manual_price": 999.99,
        }
        r = client.post(f"{API}/procedures", json=payload)
        assert r.status_code == 200
        p = r.json()
        # items_cost=50, indirect=5, total=55, margin=27.5, suggested=82.5
        assert p["items_cost"] == 50.0
        assert p["indirect_value"] == 5.0
        assert p["total_cost"] == 55.0
        assert p["margin_value"] == 27.5
        assert p["suggested_price"] == 82.5
        # final must use manual price
        assert p["final_price"] == 999.99
        # cleanup
        client.delete(f"{API}/procedures/{p['id']}")

    def test_list_procedures_returns_calculated_fields(self, client):
        r = client.get(f"{API}/procedures")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        found = next((x for x in items if x["id"] == TestProcedures.proc_id), None)
        assert found is not None
        for key in ["items_cost", "indirect_value", "total_cost",
                    "margin_value", "suggested_price", "final_price"]:
            assert key in found, f"Missing calculated field: {key}"
        assert "_id" not in found
        assert found["final_price"] == 74.4

    def test_update_procedure_recalculates(self, client):
        # Change items and percentages: items_cost = 1*100 = 100
        # indirect = 100 * 50/100 = 50, total = 150, margin = 150 * 200/100 = 300
        # suggested = 450, manual=0 -> final = 450
        payload = {
            "name": "TEST_Perfuracao_Premium_UPD",
            "items": [{"name": "Joia Premium", "qty": 1, "unit_cost": 100.0}],
            "indirect_cost_pct": 50.0,
            "margin_pct": 200.0,
            "manual_price": 0.0,
        }
        r = client.put(f"{API}/procedures/{TestProcedures.proc_id}", json=payload)
        assert r.status_code == 200
        p = r.json()
        assert p["name"] == "TEST_Perfuracao_Premium_UPD"
        assert p["items_cost"] == 100.0
        assert p["indirect_value"] == 50.0
        assert p["total_cost"] == 150.0
        assert p["margin_value"] == 300.0
        assert p["suggested_price"] == 450.0
        assert p["final_price"] == 450.0
        assert "_id" not in p

        # Verify persistence via GET list
        items = client.get(f"{API}/procedures").json()
        found = next(x for x in items if x["id"] == TestProcedures.proc_id)
        assert found["name"] == "TEST_Perfuracao_Premium_UPD"
        assert found["final_price"] == 450.0

    def test_update_404(self, client):
        r = client.put(f"{API}/procedures/nonexistent-id", json={
            "name": "X", "items": [], "indirect_cost_pct": 0, "margin_pct": 0, "manual_price": 0
        })
        assert r.status_code == 404

    def test_delete_procedure(self, client):
        r = client.delete(f"{API}/procedures/{TestProcedures.proc_id}")
        assert r.status_code == 200
        # Verify gone
        items = client.get(f"{API}/procedures").json()
        assert all(x["id"] != TestProcedures.proc_id for x in items)

    def test_delete_404(self, client):
        r = client.delete(f"{API}/procedures/nonexistent-id")
        assert r.status_code == 404

    def test_empty_items_zero_costs(self, client):
        payload = {
            "name": "TEST_Empty_Items",
            "items": [],
            "indirect_cost_pct": 20.0,
            "margin_pct": 100.0,
            "manual_price": 0.0,
        }
        r = client.post(f"{API}/procedures", json=payload)
        assert r.status_code == 200
        p = r.json()
        assert p["items_cost"] == 0.0
        assert p["indirect_value"] == 0.0
        assert p["total_cost"] == 0.0
        assert p["suggested_price"] == 0.0
        assert p["final_price"] == 0.0
        client.delete(f"{API}/procedures/{p['id']}")

