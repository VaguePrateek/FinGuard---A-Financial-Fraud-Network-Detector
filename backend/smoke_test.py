"""Smoke test for the FinGuard backend."""
import os

if os.path.exists("ledger.db"):
    os.remove("ledger.db")

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

print("1) Health:", client.get("/api/v1/health").json())

print("2) Generate dataset + detection...")
r = client.post(
    "/api/v1/generation/generate",
    json={
        "n_accounts": 96,
        "n_transactions": 900,
        "n_anomalies": 28,
        "n_rings": 3,
        "ring_size": 4,
        "seed": 42,
        "run_detection": True,
    },
)
assert r.status_code == 200, r.text
gen = r.json()
print("   accounts:", gen["accounts"], "transactions:", gen["transactions"])
print("   injected anomalies:", gen["injected_anomalies"], "rings:", gen["rings_injected"])
det = gen["detection"]
print("   detected anomalies:", det["anomalies_detected"], "cycles:", det["cycles_detected"])
print("   precision:", det["precision_score"], "recall:", det["recall_score"])
print("   duration_ms:", det["duration_ms"])

assert gen["accounts"] == 96
assert det["cycles_detected"] >= 1, "expected at least one circular ring"
assert det["anomalies_detected"] > 0, "expected anomalies"
assert det["precision_score"] is not None and det["precision_score"] > 0.5
assert det["recall_score"] is not None and det["recall_score"] > 0.5

print("3) Stats:", {k: v for k, v in client.get("/api/v1/stats").json().items() if k in (
    "ledger_volume", "transaction_count", "account_count", "anomaly_count",
    "cycle_count", "cycle_transaction_count", "high_risk_accounts")})

stats = client.get("/api/v1/stats").json()
assert stats["trend"], "expected trend data"
assert stats["type_breakdown"], "expected type breakdown"
assert len(stats["anomaly_bands"]) == 5
assert stats["top_accounts"], "expected top accounts"

print("4) Paginated transactions:", end=" ")
page = client.get("/api/v1/transactions", params={"page": 1, "page_size": 10}).json()
print("total:", page["total"], "items:", len(page["items"]))
assert page["total"] > 0 and len(page["items"]) == 10
assert "channel" in page["items"][0] and "anomaly_reason" in page["items"][0]

print("5) Filters:", end=" ")
anom = client.get("/api/v1/transactions", params={"anomaly_only": True, "page_size": 200}).json()
cyc = client.get("/api/v1/transactions", params={"cycle_only": True, "page_size": 200}).json()
print("anomaly txns:", anom["total"], "cycle txns:", cyc["total"])
assert anom["total"] == det["anomalies_detected"]
assert cyc["total"] == det["cycle_transactions"]

print("6) Cycles list:", end=" ")
cycles = client.get("/api/v1/cycles").json()
print(len(cycles), "cycles")
assert len(cycles) >= 1
first = cycles[0]
print("   top cycle:", first["cycle_key"], "risk:", first["risk_score"], "amount:", first["total_amount"])

print("7) Cycle detail:", end=" ")
detail = client.get(f"/api/v1/cycles/{first['id']}").json()
print(len(detail["transactions"]), "transactions in ring")
assert len(detail["transactions"]) == first["transaction_count"]

print("8) Cycle status update:", end=" ")
patched = client.patch(f"/api/v1/cycles/{first['id']}/status", json={"status": "reviewing"}).json()
print(patched["status"])
assert patched["status"] == "reviewing"

print("9) Graph:", end=" ")
graph = client.get("/api/v1/graph").json()
print("nodes:", len(graph["nodes"]), "edges:", len(graph["edges"]))
assert len(graph["nodes"]) > 0 and len(graph["edges"]) > 0
assert any(e["in_cycle"] for e in graph["edges"]), "expected cycle edges in graph"

print("10) Re-run detection:", end=" ")
rerun = client.post("/api/v1/detection/run", json={"contamination": 0.03})
print(rerun.status_code, rerun.json()["cycles_detected"], "cycles")
assert rerun.status_code == 200

print("\nALL BACKEND CHECKS PASSED")
