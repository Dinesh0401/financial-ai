from __future__ import annotations


async def test_register_returns_session(client) -> None:
    response = await client.post(
        "/v1/auth/register",
        json={"name": "Iyyappan", "email": "iyyappan@example.com", "password": "supersecret123"},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["access_token"].startswith("access-")
    assert payload["refresh_token"].startswith("refresh-")
    assert payload["user"]["email"] == "iyyappan@example.com"


async def test_register_duplicate_email_returns_conflict(client) -> None:
    body = {"name": "Iyyappan", "email": "duplicate@example.com", "password": "supersecret123"}
    first = await client.post("/v1/auth/register", json=body)
    second = await client.post("/v1/auth/register", json=body)

    assert first.status_code == 201
    assert second.status_code == 409


async def test_login_wrong_password_returns_unauthorized(client) -> None:
    await client.post(
        "/v1/auth/register",
        json={"name": "Iyyappan", "email": "login@example.com", "password": "supersecret123"},
    )

    response = await client.post(
        "/v1/auth/login",
        json={"email": "login@example.com", "password": "wrongsecret123"},
    )

    assert response.status_code == 401


async def test_refresh_invalid_token_returns_unauthorized(client) -> None:
    response = await client.post("/v1/auth/refresh", json={"refresh_token": "invalid"})
    assert response.status_code == 401

