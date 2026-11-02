"""SQLAlchemy models for accounts, transactions, cycles and detection runs."""

import json

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .database import Base


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    account_type = Column(String, nullable=False, default="individual")
    country = Column(String, nullable=True)
    risk_score = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transactions = relationship("Transaction", back_populates="account")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    txn_id = Column(String, unique=True, index=True, nullable=False)
    account_id = Column(String, ForeignKey("accounts.account_id"), nullable=False, index=True)
    counterparty = Column(String, nullable=False, index=True)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="USD")
    txn_type = Column(String, nullable=False)
    channel = Column(String, default="WIRE")
    description = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    is_anomaly = Column(Boolean, default=False, index=True)
    anomaly_score = Column(Float, default=0.0)
    anomaly_reason = Column(Text, nullable=True)
    in_cycle = Column(Boolean, default=False, index=True)
    cycle_id = Column(Integer, nullable=True)
    is_fraud_truth = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    account = relationship("Account", back_populates="transactions")


class Cycle(Base):
    __tablename__ = "cycles"

    id = Column(Integer, primary_key=True, index=True)
    cycle_key = Column(String, unique=True, index=True, nullable=False)
    path_json = Column(Text, nullable=False)
    size = Column(Integer, nullable=False)
    total_amount = Column(Float, nullable=False, default=0.0)
    transaction_count = Column(Integer, nullable=False, default=0)
    risk_score = Column(Float, nullable=False, default=0.0)
    status = Column(String, nullable=False, default="open")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    @property
    def path(self):
        try:
            return json.loads(self.path_json)
        except (TypeError, ValueError):
            return []


class DetectionRun(Base):
    __tablename__ = "detection_runs"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    transactions_analyzed = Column(Integer, nullable=False, default=0)
    anomalies_detected = Column(Integer, nullable=False, default=0)
    cycles_detected = Column(Integer, nullable=False, default=0)
    cycle_transactions = Column(Integer, nullable=False, default=0)
    precision_score = Column(Float, nullable=True)
    recall_score = Column(Float, nullable=True)
    contamination = Column(Float, nullable=False, default=0.03)
    duration_ms = Column(Integer, nullable=False, default=0)
