"""FinGuard API – ledger anomaly & circular-flow detection."""

import time
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import crud, data_gen, models, schemas, services
from .database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="FinGuard API",
    description="Financial ledger anomaly detection (Isolation Forest) and circular flow detection (NetworkX).",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/api/v1/health", response_model=schemas.HealthOut)
def health(db: Session = Depends(get_db)):
    count = db.query(models.Transaction).count()
    return schemas.HealthOut(
        status="ok",
        database="sqlite",
        transactions=count,
        model="isolation-forest",
        graph="networkx",
    )


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------

@app.get("/api/v1/accounts", response_model=List[schemas.AccountOut])
def list_accounts(skip: int = 0, limit: int = 500, db: Session = Depends(get_db)):
    return crud.get_accounts(db, skip=skip, limit=limit)


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------

@app.get("/api/v1/transactions", response_model=schemas.TransactionPage)
def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    txn_type: Optional[str] = None,
    anomaly_only: bool = False,
    cycle_only: bool = False,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    sort: str = "timestamp",
    order: str = "desc",
    db: Session = Depends(get_db),
):
    total, items = crud.get_transactions_page(
        db,
        page=page,
        page_size=page_size,
        search=search,
        txn_type=txn_type,
        anomaly_only=anomaly_only,
        cycle_only=cycle_only,
        min_amount=min_amount,
        max_amount=max_amount,
        sort=sort,
        order=order,
    )
    return schemas.TransactionPage(
        total=total, page=page, page_size=page_size, items=items
    )


@app.get("/api/v1/transactions/{txn_id}", response_model=schemas.TransactionOut)
def get_transaction(txn_id: str, db: Session = Depends(get_db)):
    txn = crud.get_transaction(db, txn_id)
    if txn is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return txn


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------

@app.post("/api/v1/generation/generate", response_model=schemas.GenerationResult)
def generate_ledger(payload: schemas.GenerateRequest, db: Session = Depends(get_db)):
    started = time.perf_counter()

    accounts, transactions, injected_anomalies, rings = data_gen.generate_dataset(
        n_accounts=payload.n_accounts,
        n_transactions=payload.n_transactions,
        n_anomalies=payload.n_anomalies,
        n_rings=payload.n_rings,
        ring_size=payload.ring_size,
        seed=payload.seed,
    )

    crud.reset_ledger(db)
    crud.bulk_create_accounts(db, accounts)
    crud.bulk_create_transactions(db, transactions)

    detection = None
    if payload.run_detection:
        detection = services.run_detection(db, contamination=0.03)

    duration_ms = int((time.perf_counter() - started) * 1000)

    return schemas.GenerationResult(
        accounts=len(accounts),
        transactions=len(transactions),
        normal_transactions=payload.n_transactions,
        injected_anomalies=injected_anomalies,
        rings_injected=rings,
        ring_size=payload.ring_size,
        duration_ms=duration_ms,
        detection=detection,
    )


# ---------------------------------------------------------------------------
# Detection
# ---------------------------------------------------------------------------

@app.post("/api/v1/detection/run", response_model=schemas.DetectionSummary)
def run_detection(
    payload: Optional[schemas.DetectionRequest] = None,
    db: Session = Depends(get_db),
):
    contamination = payload.contamination if payload else 0.03
    try:
        return services.run_detection(db, contamination=contamination)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Cycles
# ---------------------------------------------------------------------------

@app.get("/api/v1/cycles", response_model=List[schemas.CycleOut])
def list_cycles(status: Optional[str] = None, db: Session = Depends(get_db)):
    return crud.get_cycles(db, status=status)


@app.get("/api/v1/cycles/{cycle_id}", response_model=schemas.CycleDetail)
def get_cycle(cycle_id: int, db: Session = Depends(get_db)):
    cycle = crud.get_cycle(db, cycle_id)
    if cycle is None:
        raise HTTPException(status_code=404, detail="Cycle not found")
    base = schemas.CycleOut.model_validate(cycle)
    txns = crud.get_cycle_transactions(db, cycle_id)
    return schemas.CycleDetail(
        **base.model_dump(),
        transactions=[schemas.TransactionOut.model_validate(t) for t in txns],
    )


@app.patch("/api/v1/cycles/{cycle_id}/status", response_model=schemas.CycleOut)
def update_cycle_status(
    cycle_id: int, payload: schemas.CycleStatusUpdate, db: Session = Depends(get_db)
):
    cycle = crud.update_cycle_status(db, cycle_id, payload.status)
    if cycle is None:
        raise HTTPException(status_code=404, detail="Cycle not found")
    return cycle


# ---------------------------------------------------------------------------
# Stats & graph
# ---------------------------------------------------------------------------

@app.get("/api/v1/stats", response_model=schemas.StatsOut)
def get_stats(db: Session = Depends(get_db)):
    return crud.get_stats(db)


@app.get("/api/v1/graph", response_model=schemas.GraphOut)
def get_graph(limit_edges: int = 600, db: Session = Depends(get_db)):
    return crud.get_graph(db, limit_edges=limit_edges)
