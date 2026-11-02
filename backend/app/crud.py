"""Database access helpers for the ledger dashboard."""

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import case, desc, func, or_
from sqlalchemy.orm import Session

from . import models, schemas


# ---------------------------------------------------------------------------
# Writes
# ---------------------------------------------------------------------------

def reset_ledger(db: Session) -> None:
    db.query(models.Transaction).delete()
    db.query(models.Cycle).delete()
    db.query(models.DetectionRun).delete()
    db.query(models.Account).delete()
    db.commit()


def bulk_create_accounts(db: Session, accounts: List[Dict[str, Any]]) -> None:
    db.add_all([models.Account(**a) for a in accounts])
    db.commit()


def bulk_create_transactions(db: Session, transactions: List[Dict[str, Any]]) -> None:
    db.add_all([models.Transaction(**t) for t in transactions])
    db.commit()


def update_cycle_status(db: Session, cycle_id: int, status: str) -> Optional[models.Cycle]:
    cycle = db.get(models.Cycle, cycle_id)
    if cycle is None:
        return None
    cycle.status = status
    db.commit()
    db.refresh(cycle)
    return cycle


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------

def get_accounts(db: Session, skip: int = 0, limit: int = 500) -> List[models.Account]:
    return db.query(models.Account).order_by(models.Account.account_id).offset(skip).limit(limit).all()


def get_account(db: Session, account_id: str) -> Optional[models.Account]:
    return db.query(models.Account).filter(models.Account.account_id == account_id).first()


def get_transaction(db: Session, txn_id: str) -> Optional[models.Transaction]:
    return db.query(models.Transaction).filter(models.Transaction.txn_id == txn_id).first()


def get_transactions_page(
    db: Session,
    page: int = 1,
    page_size: int = 25,
    search: Optional[str] = None,
    txn_type: Optional[str] = None,
    anomaly_only: bool = False,
    cycle_only: bool = False,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    sort: str = "timestamp",
    order: str = "desc",
) -> Tuple[int, List[models.Transaction]]:
    query = db.query(models.Transaction)

    if search:
        needle = f"%{search.strip()}%"
        query = query.filter(
            or_(
                models.Transaction.txn_id.ilike(needle),
                models.Transaction.account_id.ilike(needle),
                models.Transaction.counterparty.ilike(needle),
                models.Transaction.description.ilike(needle),
            )
        )
    if txn_type:
        query = query.filter(models.Transaction.txn_type == txn_type)
    if anomaly_only:
        query = query.filter(models.Transaction.is_anomaly.is_(True))
    if cycle_only:
        query = query.filter(models.Transaction.in_cycle.is_(True))
    if min_amount is not None:
        query = query.filter(models.Transaction.amount >= min_amount)
    if max_amount is not None:
        query = query.filter(models.Transaction.amount <= max_amount)

    total = query.count()

    sort_column = {
        "timestamp": models.Transaction.timestamp,
        "amount": models.Transaction.amount,
        "anomaly_score": models.Transaction.anomaly_score,
        "txn_id": models.Transaction.txn_id,
    }.get(sort, models.Transaction.timestamp)

    if order == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    items = query.offset(max(page - 1, 0) * page_size).limit(page_size).all()
    return total, items


def get_cycles(db: Session, status: Optional[str] = None) -> List[models.Cycle]:
    query = db.query(models.Cycle)
    if status:
        query = query.filter(models.Cycle.status == status)
    return query.order_by(desc(models.Cycle.risk_score)).all()


def get_cycle(db: Session, cycle_id: int) -> Optional[models.Cycle]:
    return db.get(models.Cycle, cycle_id)


def get_cycle_transactions(db: Session, cycle_id: int) -> List[models.Transaction]:
    return (
        db.query(models.Transaction)
        .filter(models.Transaction.cycle_id == cycle_id)
        .order_by(models.Transaction.timestamp.asc())
        .all()
    )


def get_latest_detection(db: Session) -> Optional[models.DetectionRun]:
    return db.query(models.DetectionRun).order_by(desc(models.DetectionRun.id)).first()


# ---------------------------------------------------------------------------
# Aggregations
# ---------------------------------------------------------------------------

def get_stats(db: Session) -> schemas.StatsOut:
    transaction_count = db.query(func.count(models.Transaction.id)).scalar() or 0
    account_count = db.query(func.count(models.Account.id)).scalar() or 0
    anomaly_count = (
        db.query(func.count(models.Transaction.id))
        .filter(models.Transaction.is_anomaly.is_(True))
        .scalar()
        or 0
    )
    cycle_transaction_count = (
        db.query(func.count(models.Transaction.id))
        .filter(models.Transaction.in_cycle.is_(True))
        .scalar()
        or 0
    )
    cycle_count = db.query(func.count(models.Cycle.id)).scalar() or 0
    both_count = (
        db.query(func.count(models.Transaction.id))
        .filter(
            models.Transaction.is_anomaly.is_(True),
            models.Transaction.in_cycle.is_(True),
        )
        .scalar()
        or 0
    )
    clean_count = (
        db.query(func.count(models.Transaction.id))
        .filter(
            models.Transaction.is_anomaly.is_(False),
            models.Transaction.in_cycle.is_(False),
        )
        .scalar()
        or 0
    )
    high_risk_accounts = (
        db.query(func.count(models.Account.id))
        .filter(models.Account.risk_score >= 0.6)
        .scalar()
        or 0
    )
    ledger_volume = db.query(func.sum(models.Transaction.amount)).scalar() or 0.0
    avg_amount = db.query(func.avg(models.Transaction.amount)).scalar() or 0.0
    data_start, data_end = db.query(
        func.min(models.Transaction.timestamp), func.max(models.Transaction.timestamp)
    ).one()

    detection_row = get_latest_detection(db)
    detection = (
        schemas.DetectionInfo.model_validate(detection_row) if detection_row else None
    )

    return schemas.StatsOut(
        ledger_volume=round(float(ledger_volume), 2),
        transaction_count=transaction_count,
        account_count=account_count,
        anomaly_count=anomaly_count,
        cycle_count=cycle_count,
        cycle_transaction_count=cycle_transaction_count,
        clean_count=clean_count,
        both_count=both_count,
        high_risk_accounts=high_risk_accounts,
        avg_amount=round(float(avg_amount), 2),
        data_start=data_start,
        data_end=data_end,
        detection=detection,
        trend=_trend(db),
        type_breakdown=_type_breakdown(db),
        anomaly_bands=_anomaly_bands(db),
        top_accounts=_top_accounts(db),
    )


def _trend(db: Session) -> List[schemas.TrendPoint]:
    day = func.date(models.Transaction.timestamp)
    flagged = func.sum(
        case(
            (
                or_(
                    models.Transaction.is_anomaly.is_(True),
                    models.Transaction.in_cycle.is_(True),
                ),
                1,
            ),
            else_=0,
        )
    )
    rows = (
        db.query(
            day.label("day"),
            func.count(models.Transaction.id).label("total"),
            flagged.label("flagged"),
            func.sum(models.Transaction.amount).label("volume"),
        )
        .group_by(day)
        .order_by(day)
        .all()
    )
    return [
        schemas.TrendPoint(
            date=str(r.day),
            total=int(r.total or 0),
            flagged=int(r.flagged or 0),
            volume=round(float(r.volume or 0), 2),
        )
        for r in rows
    ]


def _type_breakdown(db: Session) -> List[schemas.TypeBreakdown]:
    rows = (
        db.query(
            models.Transaction.txn_type.label("txn_type"),
            func.count(models.Transaction.id).label("count"),
            func.sum(models.Transaction.amount).label("amount"),
        )
        .group_by(models.Transaction.txn_type)
        .order_by(desc("count"))
        .all()
    )
    return [
        schemas.TypeBreakdown(
            txn_type=r.txn_type,
            count=int(r.count or 0),
            amount=round(float(r.amount or 0), 2),
        )
        for r in rows
    ]


def _anomaly_bands(db: Session) -> List[schemas.AnomalyBand]:
    bands = [
        ("0.0 – 0.2", 0.0, 0.2),
        ("0.2 – 0.4", 0.2, 0.4),
        ("0.4 – 0.6", 0.4, 0.6),
        ("0.6 – 0.8", 0.6, 0.8),
        ("0.8 – 1.0", 0.8, 1.0001),
    ]
    result = []
    for label, low, high in bands:
        count = (
            db.query(func.count(models.Transaction.id))
            .filter(models.Transaction.anomaly_score >= low)
            .filter(models.Transaction.anomaly_score < high)
            .scalar()
            or 0
        )
        result.append(schemas.AnomalyBand(band=label, count=int(count)))
    return result


def _top_accounts(db: Session, limit: int = 8) -> List[schemas.TopAccount]:
    rows = (
        db.query(
            models.Account.account_id,
            models.Account.name,
            models.Account.account_type,
            models.Account.country,
            models.Account.risk_score,
            func.coalesce(func.sum(models.Transaction.amount), 0.0).label("volume"),
            func.count(models.Transaction.id).label("txn_count"),
            func.coalesce(
                func.sum(
                    case((models.Transaction.is_anomaly.is_(True), 1), else_=0)
                ),
                0,
            ).label("anomaly_count"),
            func.coalesce(
                func.sum(case((models.Transaction.in_cycle.is_(True), 1), else_=0)),
                0,
            ).label("cycle_count"),
        )
        .outerjoin(
            models.Transaction,
            models.Account.account_id == models.Transaction.account_id,
        )
        .group_by(
            models.Account.account_id,
            models.Account.name,
            models.Account.account_type,
            models.Account.country,
            models.Account.risk_score,
        )
        .order_by(desc("anomaly_count"), desc("cycle_count"), desc("volume"))
        .limit(limit)
        .all()
    )
    return [
        schemas.TopAccount(
            account_id=r.account_id,
            name=r.name,
            account_type=r.account_type,
            country=r.country,
            risk_score=float(r.risk_score or 0),
            volume=round(float(r.volume or 0), 2),
            txn_count=int(r.txn_count or 0),
            anomaly_count=int(r.anomaly_count or 0),
            cycle_count=int(r.cycle_count or 0),
        )
        for r in rows
    ]


def get_graph(db: Session, limit_edges: int = 600) -> schemas.GraphOut:
    accounts = db.query(models.Account).all()
    transactions = db.query(models.Transaction).all()

    nodes: Dict[str, schemas.GraphNode] = {}
    for account in accounts:
        nodes[account.account_id] = schemas.GraphNode(
            id=account.account_id,
            name=account.name,
            account_type=account.account_type,
            country=account.country,
            risk_score=float(account.risk_score or 0),
            in_cycle=False,
            txn_count=0,
            volume_in=0.0,
            volume_out=0.0,
        )

    edges: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for txn in transactions:
        src, dst = txn.account_id, txn.counterparty
        if not src or not dst or src == dst:
            continue

        if src not in nodes:
            nodes[src] = schemas.GraphNode(
                id=src, name=src, account_type="external", country=None,
                risk_score=0.0, in_cycle=False, txn_count=0,
                volume_in=0.0, volume_out=0.0,
            )
        if dst not in nodes:
            nodes[dst] = schemas.GraphNode(
                id=dst, name=dst, account_type="external", country=None,
                risk_score=0.0, in_cycle=False, txn_count=0,
                volume_in=0.0, volume_out=0.0,
            )

        nodes[src].txn_count += 1
        nodes[src].volume_out += float(txn.amount or 0)
        nodes[dst].volume_in += float(txn.amount or 0)
        if txn.in_cycle:
            nodes[src].in_cycle = True
            nodes[dst].in_cycle = True

        key = (src, dst)
        edge = edges.get(key)
        if edge is None:
            edges[key] = {
                "id": f"{src}->{dst}",
                "source": src,
                "target": dst,
                "amount": float(txn.amount or 0),
                "count": 1,
                "in_cycle": bool(txn.in_cycle),
                "cycle_id": txn.cycle_id,
            }
        else:
            edge["amount"] += float(txn.amount or 0)
            edge["count"] += 1
            edge["in_cycle"] = edge["in_cycle"] or bool(txn.in_cycle)
            if edge["cycle_id"] is None:
                edge["cycle_id"] = txn.cycle_id

    edge_list = [
        schemas.GraphEdge(
            id=e["id"],
            source=e["source"],
            target=e["target"],
            amount=round(e["amount"], 2),
            count=e["count"],
            in_cycle=e["in_cycle"],
            cycle_id=e["cycle_id"],
        )
        for e in edges.values()
    ]
    edge_list.sort(key=lambda e: (not e.in_cycle, -e.amount))
    edge_list = edge_list[:limit_edges]

    # Drop nodes that no longer have a visible edge (keeps the graph readable).
    visible = {e.source for e in edge_list} | {e.target for e in edge_list}
    node_list = [n for n in nodes.values() if n.id in visible]
    for n in node_list:
        n.volume_in = round(n.volume_in, 2)
        n.volume_out = round(n.volume_out, 2)

    return schemas.GraphOut(
        nodes=node_list,
        edges=edge_list,
        cycles=[schemas.CycleOut.model_validate(c) for c in get_cycles(db)],
    )
