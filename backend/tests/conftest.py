import os
import sys
from pathlib import Path

import pytest

# Use an isolated database for tests, before importing the app.
os.environ["DATABASE_URL"] = "sqlite:///./test_ledger.db"

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from app import models  # noqa: E402
from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def seeded_client(client):
    response = client.post(
        "/api/v1/generation/generate",
        json={
            "n_accounts": 60,
            "n_transactions": 400,
            "n_anomalies": 15,
            "n_rings": 2,
            "ring_size": 4,
            "seed": 11,
            "run_detection": True,
        },
    )
    assert response.status_code == 200, response.text
    return client, response.json()
