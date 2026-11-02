def test_health(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["model"] == "isolation-forest"
    assert body["graph"] == "networkx"


def test_generation_runs_detection(seeded_client):
    client, body = seeded_client
    assert body["accounts"] == 60
    assert body["injected_anomalies"] == 15
    assert body["rings_injected"] == 2
    assert body["transactions"] > body["normal_transactions"]

    detection = body["detection"]
    assert detection["cycles_detected"] >= 1
    assert detection["anomalies_detected"] > 0
    assert detection["precision_score"] > 0.5
    assert detection["recall_score"] > 0.5
    assert detection["cycle_transactions"] >= 8


def test_stats_shape(seeded_client):
    client, _ = seeded_client
    stats = client.get("/api/v1/stats").json()
    assert stats["transaction_count"] > 0
    assert stats["account_count"] == 60
    assert stats["anomaly_count"] > 0
    assert stats["cycle_count"] >= 1
    assert len(stats["trend"]) > 0
    assert len(stats["anomaly_bands"]) == 5
    assert len(stats["type_breakdown"]) > 0
    assert stats["detection"]["id"] >= 1


def test_transactions_pagination_and_filters(seeded_client):
    client, body = seeded_client
    page = client.get("/api/v1/transactions", params={"page": 1, "page_size": 10}).json()
    assert page["total"] == body["transactions"]
    assert len(page["items"]) == 10
    assert {"txn_id", "amount", "anomaly_score", "in_cycle", "channel"} <= set(page["items"][0])

    anomalies = client.get(
        "/api/v1/transactions", params={"anomaly_only": True, "page_size": 200}
    ).json()
    assert anomalies["total"] == body["detection"]["anomalies_detected"]

    cycles = client.get(
        "/api/v1/transactions", params={"cycle_only": True, "page_size": 200}
    ).json()
    assert cycles["total"] == body["detection"]["cycle_transactions"]


def test_cycle_detail_and_status(seeded_client):
    client, _ = seeded_client
    cycles = client.get("/api/v1/cycles").json()
    assert len(cycles) >= 1

    first = cycles[0]
    detail = client.get(f"/api/v1/cycles/{first['id']}").json()
    assert detail["size"] >= 3
    assert len(detail["transactions"]) == first["transaction_count"]
    assert detail["path"][0] == first["path"][0]

    updated = client.patch(
        f"/api/v1/cycles/{first['id']}/status", json={"status": "reviewing"}
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "reviewing"


def test_graph_contains_cycle_edges(seeded_client):
    client, _ = seeded_client
    graph = client.get("/api/v1/graph").json()
    assert len(graph["nodes"]) > 0
    assert len(graph["edges"]) > 0
    assert any(edge["in_cycle"] for edge in graph["edges"])
    assert len(graph["cycles"]) >= 1


def test_detection_requires_data(client):
    response = client.post("/api/v1/detection/run", json={"contamination": 0.03})
    assert response.status_code == 400
    assert "No transactions" in response.json()["detail"]
