"""Cycle detection on the ledger graph using NetworkX.

Nodes are accounts, directed edges are transactions. Strongly connected
components isolate candidate rings, then elementary cycles are enumerated and
scored. Every transaction on a detected cycle is tagged with a cycle id.
"""

import math
from collections import defaultdict
from typing import Any, Dict, List, Tuple

import networkx as nx

MAX_CYCLES = 60
MAX_CYCLE_LENGTH = 10


def build_graph(transactions: List[Dict[str, Any]]) -> nx.DiGraph:
    graph = nx.DiGraph()
    for txn in transactions:
        src = txn.get("account_id")
        dst = txn.get("counterparty")
        if not src or not dst or src == dst:
            continue
        graph.add_edge(src, dst)
    return graph


def _canonical_cycle(cycle: List[str]) -> Tuple[str, ...]:
    if not cycle:
        return tuple()
    rotations = [tuple(cycle[i:] + cycle[:i]) for i in range(len(cycle))]
    return min(rotations)


def _cycle_risk(cycle_size: int, total_amount: float, transaction_count: int, roundness: float) -> float:
    amount_component = min(30.0, math.log10(max(total_amount, 10.0)) * 7.0)
    size_component = min(22.0, cycle_size * 3.5)
    velocity_component = min(8.0, transaction_count * 0.8)
    round_component = 6.0 if roundness >= 0.7 else 0.0
    return round(min(99.0, 38.0 + amount_component + size_component + velocity_component + round_component), 1)


def detect_cycles(transactions: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Return (cycle records, annotated transactions).

    Cycle records contain a path, aggregate amount, risk score and the list of
    transaction dicts that make up the ring.
    """
    for txn in transactions:
        txn["in_cycle"] = False
        txn["cycle_id"] = None
        txn["_cycle_temp_id"] = None

    if not transactions:
        return [], transactions

    graph = build_graph(transactions)
    edge_txns: Dict[Tuple[str, str], List[Dict[str, Any]]] = defaultdict(list)
    for txn in transactions:
        src, dst = txn.get("account_id"), txn.get("counterparty")
        if src and dst and src != dst:
            edge_txns[(src, dst)].append(txn)

    raw_cycles: List[List[str]] = []
    for component in nx.strongly_connected_components(graph):
        if len(component) < 2:
            continue
        subgraph = graph.subgraph(component)
        length_bound = min(MAX_CYCLE_LENGTH, len(component))
        try:
            found = nx.simple_cycles(subgraph, length_bound=length_bound)
            for cycle in found:
                if len(cycle) < 2:
                    continue
                raw_cycles.append(cycle)
                if len(raw_cycles) >= MAX_CYCLES * 4:
                    break
        except Exception:
            continue
        if len(raw_cycles) >= MAX_CYCLES * 4:
            break

    seen: set[Tuple[str, ...]] = set()
    cycles: List[Dict[str, Any]] = []

    for cycle in raw_cycles:
        canonical = _canonical_cycle(cycle)
        if canonical in seen:
            continue
        seen.add(canonical)

        ring_txns: List[Dict[str, Any]] = []
        for i, node in enumerate(cycle):
            nxt = cycle[(i + 1) % len(cycle)]
            ring_txns.extend(edge_txns.get((node, nxt), []))
        if not ring_txns:
            continue

        total_amount = round(sum(float(t["amount"]) for t in ring_txns), 2)
        roundness = sum(1 for t in ring_txns if float(t["amount"]) % 100 == 0) / max(len(ring_txns), 1)
        cycles.append(
            {
                "cycle_key": " > ".join(canonical),
                "path": list(canonical),
                "size": len(canonical),
                "total_amount": total_amount,
                "transaction_count": len(ring_txns),
                "risk_score": _cycle_risk(len(canonical), total_amount, len(ring_txns), roundness),
                "transactions": ring_txns,
            }
        )

    cycles.sort(key=lambda c: c["risk_score"], reverse=True)
    cycles = cycles[:MAX_CYCLES]

    # Highest risk cycle owns an edge when rings overlap.
    for index, cycle in enumerate(cycles):
        temp_id = index + 1
        for txn in cycle["transactions"]:
            if txn.get("_cycle_temp_id") is None:
                txn["_cycle_temp_id"] = temp_id
                txn["in_cycle"] = True
                txn["cycle_id"] = temp_id

    return cycles, transactions
