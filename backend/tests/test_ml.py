from datetime import datetime, timedelta

from app.ml.anomaly import detect_anomalies
from app.ml.cycles import detect_cycles


def _txn(txn_id, src, dst, amount, ts):
    return {
        "id": txn_id,
        "txn_id": txn_id,
        "account_id": src,
        "counterparty": dst,
        "amount": amount,
        "currency": "USD",
        "txn_type": "TRANSFER",
        "channel": "WIRE",
        "description": "",
        "timestamp": ts.isoformat(),
        "is_anomaly": False,
        "anomaly_score": 0.0,
        "anomaly_reason": None,
        "in_cycle": False,
        "cycle_id": None,
        "is_fraud_truth": False,
    }


def test_isolation_forest_flags_large_outlier():
    start = datetime(2025, 1, 1)
    txns = [
        _txn(f"T{i}", f"ACC-{i % 10}", f"ACC-{(i + 3) % 10}", 100 + i, start + timedelta(hours=i))
        for i in range(80)
    ]
    txns.append(_txn("OUTLIER", "ACC-1", "ACC-2", 500000, start + timedelta(hours=90)))

    result = detect_anomalies(txns, contamination=0.05)
    flagged = {t["txn_id"] for t in result if t["is_anomaly"]}
    assert "OUTLIER" in flagged
    outlier = next(t for t in result if t["txn_id"] == "OUTLIER")
    assert outlier["anomaly_score"] > 0.5
    assert outlier["anomaly_reason"]


def test_networkx_detects_directed_cycle():
    start = datetime(2025, 1, 1)
    txns = [
        _txn("A-B", "A", "B", 1000, start),
        _txn("B-C", "B", "C", 1000, start + timedelta(hours=1)),
        _txn("C-A", "C", "A", 1000, start + timedelta(hours=2)),
        _txn("D-E", "D", "E", 500, start + timedelta(hours=3)),
    ]
    cycles, annotated = detect_cycles(txns)
    assert len(cycles) == 1
    cycle = cycles[0]
    assert set(cycle["path"]) == {"A", "B", "C"}
    flagged = {t["txn_id"] for t in annotated if t["in_cycle"]}
    assert flagged == {"A-B", "B-C", "C-A"}
    clean = next(t for t in annotated if t["txn_id"] == "D-E")
    assert clean["in_cycle"] is False


def test_networkx_ignores_acyclic_chain():
    start = datetime(2025, 1, 1)
    txns = [
        _txn("A-B", "A", "B", 1000, start),
        _txn("B-C", "B", "C", 1000, start + timedelta(hours=1)),
        _txn("C-D", "C", "D", 1000, start + timedelta(hours=2)),
    ]
    cycles, annotated = detect_cycles(txns)
    assert cycles == []
    assert all(not t["in_cycle"] for t in annotated)
