"""Synthetic financial ledger generation with injected fraud patterns.

The generator builds a realistic-looking ledger while keeping the background
transaction graph acyclic. Fraud is injected as:

* high-value statistical outliers -> caught by Isolation Forest
* circular transfer rings -> caught by NetworkX cycle detection
* an optional random seed makes demos reproducible
"""

import math
import random
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

FIRST_NAMES = [
    "Amelia", "Noah", "Priya", "Mateo", "Sofia", "Lucas", "Aisha", "Ethan",
    "Mei", "Omar", "Isla", "Ravi", "Elena", "Kofi", "Hana", "Leo",
]
LAST_NAMES = [
    "Hart", "Okafor", "Sharma", "Vargas", "Ricci", "Chen", "Bennett",
    "Khan", "Novak", "Mensah", "Silva", "Kim", "Fischer", "Duarte",
]
COMPANY_PREFIXES = [
    "Northwind", "Meridian", "Blue Harbor", "Atlas", "Crescent", "Silverline",
    "Orion", "Vantage", "Summit", "Cedar", "Ironbridge", "Solstice",
]
COMPANY_SUFFIXES = ["Holdings", "Capital", "Trading", "Logistics", "Partners", "Ventures"]
COUNTRIES = ["US", "GB", "DE", "FR", "SG", "AE", "CH", "NL", "CA", "AU"]
OFFSHORE = ["KY", "PA", "CY", "BVI", "MU", "SC"]
TXN_TYPES = ["TRANSFER", "PAYMENT", "WITHDRAWAL", "DEPOSIT", "REFUND"]
CHANNELS = ["WIRE", "ACH", "CARD", "MOBILE", "ONLINE", "BRANCH"]
DESCRIPTIONS = [
    "Vendor settlement", "Payroll batch", "Client invoice", "Supplier payment",
    "Operational transfer", "Subscription billing", "Refund processing",
    "Treasury rebalance", "Consulting retainer", "Inventory purchase",
]
ANOMALY_DESCRIPTIONS = [
    "Urgent overseas supplier payment", "Confidential deal settlement",
    "Manual override transfer", "Priority acquisition escrow",
    "Emergency liquidity transfer",
]


def _utcnow() -> datetime:
    return datetime.utcnow()


def _pick_name(rng: random.Random, account_type: str) -> str:
    if account_type == "business":
        return f"{rng.choice(COMPANY_PREFIXES)} {rng.choice(COMPANY_SUFFIXES)}"
    if account_type == "shell":
        return f"{rng.choice(COMPANY_PREFIXES)} {rng.choice(COMPANY_SUFFIXES)} Ltd"
    return f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}"


def generate_accounts(n: int = 96, rng: Optional[random.Random] = None) -> List[Dict[str, Any]]:
    rng = rng or random.Random()
    n = max(20, n)
    n_shells = max(4, int(round(n * 0.18)))
    n_shells = min(n_shells, n - 8)

    accounts: List[Dict[str, Any]] = []
    for i in range(n):
        aid = f"ACC-{1001 + i}"
        if i < n_shells:
            account_type = "shell"
            country = rng.choice(OFFSHORE)
            risk = round(rng.uniform(0.55, 0.96), 2)
        elif i < n_shells + int((n - n_shells) * 0.30):
            account_type = "business"
            country = rng.choice(COUNTRIES)
            risk = round(rng.uniform(0.18, 0.62), 2)
        else:
            account_type = "individual"
            country = rng.choice(COUNTRIES)
            risk = round(rng.uniform(0.03, 0.38), 2)

        accounts.append(
            {
                "account_id": aid,
                "name": _pick_name(rng, account_type),
                "account_type": account_type,
                "country": country,
                "risk_score": risk,
            }
        )
    return accounts


def _normal_amount(rng: random.Random, txn_type: str) -> float:
    base = rng.lognormvariate(4.45, 0.85)
    multiplier = {
        "TRANSFER": 2.1,
        "PAYMENT": 1.0,
        "WITHDRAWAL": 0.65,
        "DEPOSIT": 1.4,
        "REFUND": 0.45,
    }.get(txn_type, 1.0)
    amount = max(12.0, min(24000.0, base * multiplier))
    if rng.random() < 0.35:
        amount = round(amount)
    return round(amount, 2)


def generate_transactions(
    accounts: List[Dict[str, Any]],
    n_normal: int = 900,
    n_anomalies: int = 28,
    n_rings: int = 3,
    ring_size: int = 4,
    rng: Optional[random.Random] = None,
) -> Tuple[List[Dict[str, Any]], int, int]:
    """Build ledger transactions.

    Returns (transactions, injected_anomalies, rings_injected).
    """
    rng = rng or random.Random()
    now = _utcnow()
    window_start = now - timedelta(days=28)

    shell_accounts = [a for a in accounts if a["account_type"] == "shell"]
    normal_accounts = [a for a in accounts if a["account_type"] != "shell"]
    if not normal_accounts:
        normal_accounts = accounts

    # Ranks keep the normal transfer graph acyclic (edges only move up a rank).
    ranks = {a["account_id"]: rng.randint(0, 9) for a in normal_accounts}
    by_rank = {rank: [a for a in normal_accounts if ranks[a["account_id"]] == rank] for rank in range(10)}

    def ordered_pair():
        src_rank = rng.randint(0, 7)
        dst_floor = src_rank + 1
        dst_candidates = [a for r in range(dst_floor, 10) for a in by_rank[r]]
        if not dst_candidates:
            return None
        src_candidates = by_rank[src_rank] or normal_accounts
        return rng.choice(src_candidates), rng.choice(dst_candidates)

    transactions: List[Dict[str, Any]] = []
    seq = 100000

    def next_id() -> str:
        nonlocal seq
        seq += 1
        return f"TXN-{seq}"

    def random_time() -> datetime:
        seconds = rng.randint(0, 28 * 24 * 3600 - 1)
        return window_start + timedelta(seconds=seconds)

    # --- Background activity: sparse, acyclic transfer graph ---
    for _ in range(n_normal):
        pair = ordered_pair()
        if pair is None:
            continue
        src, dst = pair
        txn_type = rng.choices(TXN_TYPES, weights=[30, 32, 12, 12, 14], k=1)[0]
        transactions.append(
            {
                "txn_id": next_id(),
                "account_id": src["account_id"],
                "counterparty": dst["account_id"],
                "amount": _normal_amount(rng, txn_type),
                "currency": "USD",
                "txn_type": txn_type,
                "channel": rng.choices(CHANNELS, weights=[20, 28, 20, 12, 16, 4], k=1)[0],
                "description": rng.choice(DESCRIPTIONS),
                "timestamp": random_time(),
                "is_anomaly": False,
                "anomaly_score": 0.0,
                "anomaly_reason": None,
                "in_cycle": False,
                "cycle_id": None,
                "is_fraud_truth": False,
            }
        )

    # --- High-value outliers: the signal for Isolation Forest ---
    anomaly_count = 0
    for _ in range(n_anomalies):
        pair = ordered_pair()
        if pair is None:
            continue
        src, dst = pair
        amount = round(rng.uniform(38000, 245000), 2)
        transactions.append(
            {
                "txn_id": next_id(),
                "account_id": src["account_id"],
                "counterparty": dst["account_id"],
                "amount": amount,
                "currency": "USD",
                "txn_type": "TRANSFER",
                "channel": rng.choice(["WIRE", "ONLINE"]),
                "description": rng.choice(ANOMALY_DESCRIPTIONS),
                "timestamp": random_time(),
                "is_anomaly": False,
                "anomaly_score": 0.0,
                "anomaly_reason": None,
                "in_cycle": False,
                "cycle_id": None,
                "is_fraud_truth": True,
            }
        )
        anomaly_count += 1

    # --- Circular rings: the signal for NetworkX ---
    ring_size = max(3, min(8, ring_size))
    max_rings = len(shell_accounts) // ring_size if ring_size else 0
    rings = min(n_rings, max_rings)
    used_shells: set[str] = set()

    for ring_index in range(rings):
        available = [a for a in shell_accounts if a["account_id"] not in used_shells]
        if len(available) < ring_size:
            break
        ring = rng.sample(available, ring_size)
        used_shells.update(a["account_id"] for a in ring)
        rounds = rng.randint(2, 3)
        base_amount = rng.uniform(1100, 3900)
        ring_start = now - timedelta(days=rng.randint(1, 12), hours=rng.randint(0, 20))

        for round_no in range(rounds):
            round_time = ring_start + timedelta(hours=round_no * rng.randint(9, 22))
            for i, account in enumerate(ring):
                dst = ring[(i + 1) % ring_size]
                amount = round(base_amount * rng.uniform(0.92, 1.08))
                transactions.append(
                    {
                        "txn_id": next_id(),
                        "account_id": account["account_id"],
                        "counterparty": dst["account_id"],
                        "amount": float(amount),
                        "currency": "USD",
                        "txn_type": "TRANSFER",
                        "channel": rng.choice(["WIRE", "ONLINE"]),
                        "description": f"Circular settlement - layer {round_no + 1}",
                        "timestamp": round_time + timedelta(minutes=i * rng.randint(12, 48)),
                        "is_anomaly": False,
                        "anomaly_score": 0.0,
                        "anomaly_reason": None,
                        "in_cycle": False,
                        "cycle_id": None,
                        "is_fraud_truth": True,
                    }
                )

        # Connect the ring to the legitimate ledger with one-way funding
        # transfers. This keeps the network graph readable without creating
        # extra cycles (the normal graph is a DAG and the ring has no exit).
        for _ in range(2):
            funder = rng.choice(normal_accounts)
            transactions.append(
                {
                    "txn_id": next_id(),
                    "account_id": funder["account_id"],
                    "counterparty": ring[0]["account_id"],
                    "amount": round(rng.uniform(4500, 18000), 2),
                    "currency": "USD",
                    "txn_type": "TRANSFER",
                    "channel": "WIRE",
                    "description": "Supplier onboarding payment",
                    "timestamp": ring_start - timedelta(hours=rng.randint(2, 72)),
                    "is_anomaly": False,
                    "anomaly_score": 0.0,
                    "anomaly_reason": None,
                    "in_cycle": False,
                    "cycle_id": None,
                    "is_fraud_truth": False,
                }
            )

    rng.shuffle(transactions)
    return transactions, anomaly_count, rings


def generate_dataset(
    n_accounts: int = 96,
    n_transactions: int = 900,
    n_anomalies: int = 28,
    n_rings: int = 3,
    ring_size: int = 4,
    seed: Optional[int] = None,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], int, int]:
    rng = random.Random(seed) if seed is not None else random.Random()
    accounts = generate_accounts(n_accounts, rng)
    transactions, injected_anomalies, rings = generate_transactions(
        accounts,
        n_normal=n_transactions,
        n_anomalies=n_anomalies,
        n_rings=n_rings,
        ring_size=ring_size,
        rng=rng,
    )
    return accounts, transactions, injected_anomalies, rings
