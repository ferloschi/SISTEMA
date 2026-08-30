"""Non-destructive production API contract checks.

These tests validate that the routes consumed by the frontend are published by
FastAPI. They never create, update, or delete business data.
"""

import json
import os
import unittest
from urllib.request import urlopen


BASE_URL = os.getenv("API_BASE_URL", "https://api.drabrinquinho.com.br").rstrip("/")
TIMEOUT = 15


EXPECTED_ROUTES = {
    ("post", "/api/auth/login"),
    ("get", "/api/auth/me"),
    ("post", "/api/auth/change-email"),
    ("post", "/api/auth/change-password"),
    ("get", "/api/settings"),
    ("put", "/api/settings"),
    ("get", "/api/dashboard"),
    ("get", "/api/reminders/pending"),
    ("post", "/api/sales/{sale_id}/mark-called"),
    ("post", "/api/sales/bulk-delete"),
    ("get", "/api/products"),
    ("post", "/api/products"),
    ("put", "/api/products/{product_id}"),
    ("delete", "/api/products/{product_id}"),
    ("get", "/api/payment-methods"),
    ("post", "/api/payment-methods"),
    ("put", "/api/payment-methods/{pm_id}"),
    ("delete", "/api/payment-methods/{pm_id}"),
    ("get", "/api/reports/monthly"),
    ("get", "/api/finance/summary"),
    ("get", "/api/finance/card-sales"),
    ("get", "/api/finance/receivables"),
    ("delete", "/api/sales/{sale_id}/installments/{installment_num}"),
    ("patch", "/api/sales/{sale_id}/installments/{installment_num}"),
    ("get", "/api/insumos"),
    ("post", "/api/insumos"),
    ("put", "/api/insumos/{insumo_id}"),
    ("delete", "/api/insumos/{insumo_id}"),
    ("get", "/api/post-sale"),
    ("post", "/api/sales/{sale_id}/mark-pending"),
    ("get", "/api/procedures"),
    ("post", "/api/procedures"),
    ("put", "/api/procedures/{proc_id}"),
    ("delete", "/api/procedures/{proc_id}"),
    ("get", "/api/sales"),
    ("post", "/api/sales"),
    ("delete", "/api/sales/{sale_id}"),
}


def fetch_json(path):
    with urlopen(f"{BASE_URL}{path}", timeout=TIMEOUT) as response:
        if response.status >= 400:
            raise RuntimeError(f"GET {path} returned HTTP {response.status}")
        return json.load(response)


class ProductionApiContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.openapi_schema = fetch_json("/openapi.json")

    def test_health_endpoint(self):
        self.assertEqual(fetch_json("/api/").get("status"), "ok")

    def test_frontend_route_contract(self):
        published = {
            (method.lower(), path)
            for path, operations in self.openapi_schema["paths"].items()
            for method in operations
            if method.lower() in {"get", "post", "put", "patch", "delete"}
        }

        missing = EXPECTED_ROUTES - published
        self.assertFalse(
            missing,
            f"Frontend routes missing from API: {sorted(missing)}",
        )

    def test_removed_legacy_routes_are_not_published(self):
        paths = self.openapi_schema["paths"]
        self.assertNotIn("/api/patients", paths)
        self.assertNotIn("/api/appointments", paths)


if __name__ == "__main__":
    unittest.main()
