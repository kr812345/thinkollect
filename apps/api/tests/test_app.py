"""General app behavior: health checks, security headers, error bodies."""


def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_root(client):
    assert client.get("/").status_code == 200


def test_security_headers_present(client):
    response = client.get("/api/health")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"


def test_unknown_route_404(client):
    assert client.get("/api/nope").status_code == 404


def test_validation_error_shape_is_clean(client):
    """422 responses must not leak internal exception context."""
    response = client.post("/api/auth/signup", json={"email": 123})
    assert response.status_code == 422
    for error in response.json()["detail"]:
        assert set(error) <= {"loc", "msg"}
