"""Detection orchestration: run models, persist results, build summaries."""

import json
import time
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from . import models, schemas
from .ml import anomaly as anomaly_ml
from .ml import cycles as cycles_ml


def _txn_to_dict(txn: models.Transaction) -> Dict[str, Any]:
    return {
        "id": txn.id,
        "txn_id": txn.txn_id,
        "account_id": txn.account_id,
        "counterparty": txn.counterparty,
        "amount": float(txn.amount),
        "currency": txn.currency,
        "txn_type": txn.txn_type,
        "channel": txn.channel,
        "description": txn.description,
        "timestamp": txn.timestamp.isoformat() if txn.timestamp else None,
        "is_anomaly": txn.is_anomaly,
        "anomaly_score": float(txn.anomaly_score or 0.0),
        "anomaly_reason": txn.anomaly_reason,
        "in_cycle": txn.in_cycle,
        "cycle_id": txn.cycle_id,
        "is_fraud_truth": txn.is_fraud_truth,
    }


def run_detection(db: Session, contamination: float = 0.03) -> schemas.DetectionSummary:
    """Run Isolation Forest + NetworkX over the ledger and persist the outcome."""
    started = time.perf_counter()

    transactions = db.query(models.Transaction).all()
    if not transactions:
        raise ValueError("No transactions to analyse. Generate a ledger first.")

    txn_dicts = [_txn_to_dict(t) for t in transactions]

    # 1) Isolation Forest anomaly scoring
    txn_dicts = anomaly_ml.detect_anomalies(txn_dicts, contamination=contamination)

    # 2) NetworkX circular-flow detection
    cycle_records, txn_dicts = cycles_ml.detect_cycles(txn_dicts)

    by_txn_id = {t["txn_id"]: t for t in txn_dicts}

    # Persist transaction-level flags
    for txn in transactions:
        result = by_txn_id[txn.txn_id]
        txn.is_anomaly = bool(result["is_anomaly"])
        txn.anomaly_score = float(result["anomaly_score"])
        txn.anomaly_reason = result.get("anomaly_reason")
        txn.in_cycle = bool(result["in_cycle"])

    # Replace previous cycle records and map temp ids -> DB ids
    db.query(models.Cycle).delete()
    db.flush()

    temp_to_db: Dict[int, int] = {}
    cycle_rows: List[models.Cycle] = []
    for index, record in enumerate(cycle_records, start=1):
        row = models.Cycle(
            cycle_key=record["cycle_key"],
            path_json=json.dumps(record["path"]),
            size=record["size"],
            total_amount=record["total_amount"],
            transaction_count=record["transaction_count"],
            risk_score=record["risk_score"],
            status="open",
        )
        db.add(row)
        db.flush()
        temp_to_db[index] = row.id
        cycle_rows.append(row)

    for txn in transactions:
        result = by_txn_id[txn.txn_id]
        temp_id = result.get("_cycle_temp_id")
        txn.cycle_id = temp_to_db.get(temp_id) if temp_id else None

    db.commit()

    # Evaluation against the generator's ground truth (when present)
    truth = {t["txn_id"] for t in txn_dicts if t.get("is_fraud_truth")}
    predicted = {
        t["txn_id"] for t in txn_dicts if t.get("is_anomaly") or t.get("in_cycle")
    }
    true_positive = len(truth & predicted)
    precision = round(true_positive / len(predicted), 4) if predicted else None
    recall = round(true_positive / len(truth), 4) if truth else None

    duration_ms = int((time.perf_counter() - started) * 1000)
    anomaly_count = sum(1 for t in txn_dicts if t["is_anomaly"])
    cycle_txn_count = sum(1 for t in txn_dicts if t["in_cycle"])

    run_row = models.DetectionRun(
        transactions_analyzed=len(txn_dicts),
        anomalies_detected=anomaly_count,
        cycles_detected=len(cycle_rows),
        cycle_transactions=cycle_txn_count,
        precision_score=precision,
        recall_score=recall,
        contamination=contamination,
        duration_ms=duration_ms,
    )
    db.add(run_row)
    db.commit()
    db.refresh(run_row)

    top_anomalies = sorted(
        (t for t in txn_dicts if t["is_anomaly"]),
        key=lambda t: t["anomaly_score"],
        reverse=True,
    )[:10]

    return schemas.DetectionSummary(
        transactions_analyzed=len(txn_dicts),
        anomalies_detected=anomaly_count,
        cycles_detected=len(cycle_rows),
        cycle_transactions=cycle_txn_count,
        precision_score=precision,
        recall_score=recall,
        contamination=contamination,
        duration_ms=duration_ms,
        top_anomalies=[schemas.TransactionOut.model_validate(t) for t in top_anomalies],
        cycles=[schemas.CycleOut.model_validate(c) for c in cycle_rows],
        run=schemas.DetectionInfo.model_validate(run_row),
    )
