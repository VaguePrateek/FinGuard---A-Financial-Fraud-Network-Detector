"""Isolation Forest anomaly detection with ledger-aware features."""

from typing import Any, Dict, List

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest


def build_feature_frame(transactions: List[Dict[str, Any]]) -> pd.DataFrame:
    """Turn raw ledger rows into model features.

    Features:
      amount, log amount, global/account amount z-scores, counterparty
      frequency, in/out degree, daily account velocity and round-amount flag.
    """
    df = pd.DataFrame(transactions)
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0.0)

    df["log_amount"] = np.log1p(df["amount"])
    amount_mean = float(df["amount"].mean() or 0.0)
    amount_std = float(df["amount"].std(ddof=0) or 0.0)
    df["global_amount_zscore"] = (df["amount"] - amount_mean) / (amount_std + 1e-9)

    acct_mean = df.groupby("account_id")["amount"].transform("mean")
    acct_std = df.groupby("account_id")["amount"].transform("std").fillna(0.0)
    df["account_amount_zscore"] = (df["amount"] - acct_mean) / (acct_std + 1e-9)

    counterparty_freq = df["counterparty"].value_counts()
    df["counterparty_frequency"] = df["counterparty"].map(counterparty_freq).fillna(1)

    df["out_degree"] = df.groupby("account_id")["txn_id"].transform("count")
    df["in_degree"] = df.groupby("counterparty")["txn_id"].transform("count")

    day_bucket = df["timestamp"].dt.floor("D")
    df["daily_txn_count"] = df.groupby(["account_id", day_bucket])["txn_id"].transform("count")
    df["is_round_amount"] = (df["amount"] % 100 == 0).astype(int)

    feature_cols = [
        "amount",
        "log_amount",
        "global_amount_zscore",
        "account_amount_zscore",
        "counterparty_frequency",
        "out_degree",
        "in_degree",
        "daily_txn_count",
        "is_round_amount",
    ]
    return df[feature_cols].replace([np.inf, -np.inf], 0).fillna(0)


def _reason_for(row: pd.Series, amount_median: float, high_amount: float) -> str:
    reasons: List[str] = []
    amount = float(row["amount"])
    if amount_median > 0 and amount >= high_amount:
        reasons.append(f"Amount is {amount / amount_median:.0f}x the ledger median")
    elif abs(float(row["account_amount_zscore"])) >= 2.5:
        reasons.append("Account-level spend outlier")
    if float(row["daily_txn_count"]) >= 6:
        reasons.append("High-velocity transfer burst")
    if float(row["counterparty_frequency"]) <= 2:
        reasons.append("Rare counterparty relationship")
    if float(row["is_round_amount"]) and not reasons:
        reasons.append("Structured round-amount payment")
    if not reasons:
        reasons.append("Unusual multivariate transaction pattern")
    return " · ".join(reasons[:2])


def detect_anomalies(
    transactions: List[Dict[str, Any]], contamination: float = 0.03
) -> List[Dict[str, Any]]:
    """Run Isolation Forest and annotate transactions with flags and scores."""
    if not transactions:
        return []

    if len(transactions) < 10:
        for t in transactions:
            t["is_anomaly"] = False
            t["anomaly_score"] = 0.0
            t["anomaly_reason"] = None
        return transactions

    X = build_feature_frame(transactions)
    model = IsolationForest(
        n_estimators=250,
        max_samples="auto",
        contamination=contamination,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X)

    decision = model.decision_function(X)
    raw = -decision
    score_min, score_max = float(raw.min()), float(raw.max())
    if score_max - score_min < 1e-9:
        scaled = np.zeros_like(raw)
    else:
        scaled = np.clip((raw - score_min) / (score_max - score_min), 0.0, 1.0)

    predictions = model.predict(X)
    amounts = [float(t["amount"]) for t in transactions]
    amount_median = float(np.median(amounts)) if amounts else 0.0
    high_amount = float(np.percentile(amounts, 97)) if len(amounts) > 10 else float("inf")

    frame = pd.DataFrame(
        {
            "amount": amounts,
            "account_amount_zscore": X["account_amount_zscore"].to_numpy(),
            "daily_txn_count": X["daily_txn_count"].to_numpy(),
            "counterparty_frequency": X["counterparty_frequency"].to_numpy(),
            "is_round_amount": X["is_round_amount"].to_numpy(),
        }
    )

    for i, txn in enumerate(transactions):
        flagged = bool(predictions[i] == -1)
        txn["is_anomaly"] = flagged
        txn["anomaly_score"] = round(float(scaled[i]), 4)
        txn["anomaly_reason"] = (
            _reason_for(frame.iloc[i], amount_median, high_amount) if flagged else None
        )

    return transactions
