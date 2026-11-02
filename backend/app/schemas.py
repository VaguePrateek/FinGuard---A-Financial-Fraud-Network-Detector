"""Pydantic request / response schemas."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class AccountOut(BaseModel):
    id: int
    account_id: str
    name: str
    account_type: str
    country: Optional[str] = None
    risk_score: float

    class Config:
        from_attributes = True


class TransactionOut(BaseModel):
    id: int
    txn_id: str
    account_id: str
    counterparty: str
    amount: float
    currency: str
    txn_type: str
    channel: str
    description: Optional[str] = None
    timestamp: Optional[datetime] = None
    is_anomaly: bool
    anomaly_score: float
    anomaly_reason: Optional[str] = None
    in_cycle: bool
    cycle_id: Optional[int] = None
    is_fraud_truth: bool = False

    class Config:
        from_attributes = True


class TransactionPage(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[TransactionOut]


class GenerateRequest(BaseModel):
    n_accounts: int = Field(default=96, ge=20, le=500)
    n_transactions: int = Field(default=900, ge=50, le=10000)
    n_anomalies: int = Field(default=28, ge=0, le=500)
    n_rings: int = Field(default=3, ge=0, le=20)
    ring_size: int = Field(default=4, ge=3, le=8)
    seed: Optional[int] = None
    run_detection: bool = True


class DetectionRequest(BaseModel):
    contamination: float = Field(default=0.03, ge=0.005, le=0.2)


class GenerationResult(BaseModel):
    accounts: int
    transactions: int
    normal_transactions: int
    injected_anomalies: int
    rings_injected: int
    ring_size: int
    duration_ms: int
    detection: Optional["DetectionSummary"] = None


class AnomalyBand(BaseModel):
    band: str
    count: int


class TrendPoint(BaseModel):
    date: str
    total: int
    flagged: int
    volume: float


class TypeBreakdown(BaseModel):
    txn_type: str
    count: int
    amount: float


class TopAccount(BaseModel):
    account_id: str
    name: str
    account_type: str
    country: Optional[str] = None
    risk_score: float
    volume: float
    txn_count: int
    anomaly_count: int
    cycle_count: int


class DetectionInfo(BaseModel):
    id: int
    created_at: Optional[datetime] = None
    transactions_analyzed: int
    anomalies_detected: int
    cycles_detected: int
    cycle_transactions: int
    precision_score: Optional[float] = None
    recall_score: Optional[float] = None
    contamination: float
    duration_ms: int

    class Config:
        from_attributes = True


class StatsOut(BaseModel):
    ledger_volume: float
    transaction_count: int
    account_count: int
    anomaly_count: int
    cycle_count: int
    cycle_transaction_count: int
    clean_count: int
    both_count: int
    high_risk_accounts: int
    avg_amount: float
    data_start: Optional[datetime] = None
    data_end: Optional[datetime] = None
    detection: Optional[DetectionInfo] = None
    trend: List[TrendPoint]
    type_breakdown: List[TypeBreakdown]
    anomaly_bands: List[AnomalyBand]
    top_accounts: List[TopAccount]


class CycleOut(BaseModel):
    id: int
    cycle_key: str
    path: List[str]
    size: int
    total_amount: float
    transaction_count: int
    risk_score: float
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CycleDetail(CycleOut):
    transactions: List[TransactionOut]


class CycleStatusUpdate(BaseModel):
    status: str = Field(pattern="^(open|reviewing|dismissed)$")


class DetectionSummary(BaseModel):
    transactions_analyzed: int
    anomalies_detected: int
    cycles_detected: int
    cycle_transactions: int
    precision_score: Optional[float] = None
    recall_score: Optional[float] = None
    contamination: float
    duration_ms: int
    top_anomalies: List[TransactionOut]
    cycles: List[CycleOut]
    run: DetectionInfo


class GraphNode(BaseModel):
    id: str
    name: str
    account_type: str
    country: Optional[str] = None
    risk_score: float
    in_cycle: bool
    txn_count: int
    volume_in: float
    volume_out: float


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    amount: float
    count: int
    in_cycle: bool
    cycle_id: Optional[int] = None


class GraphOut(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    cycles: List[CycleOut]


class HealthOut(BaseModel):
    status: str
    database: str
    transactions: int
    model: str = "isolation-forest"
    graph: str = "networkx"


GenerationResult.model_rebuild()
