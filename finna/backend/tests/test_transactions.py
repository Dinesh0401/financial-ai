from __future__ import annotations

from datetime import date
from unittest.mock import patch

from app.services.statement_parser import PdfPasswordRequiredError


async def _register_and_token(client, email: str) -> tuple[str, str]:
    response = await client.post(
        "/v1/auth/register",
        json={"name": "Tester", "email": email, "password": "supersecret123"},
    )
    payload = response.json()
    return payload["access_token"], payload["refresh_token"]


async def test_manual_transaction_list_and_summary_are_user_scoped(client) -> None:
    token_a, _ = await _register_and_token(client, "user-a@example.com")
    token_b, _ = await _register_and_token(client, "user-b@example.com")

    create = await client.post(
        "/v1/transactions/manual",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "amount": "450.00",
            "merchant": "Swiggy",
            "txn_type": "debit",
            "date": date.today().isoformat(),
            "description": "Lunch order",
        },
    )
    assert create.status_code == 201

    list_a = await client.get("/v1/transactions", headers={"Authorization": f"Bearer {token_a}"})
    list_b = await client.get("/v1/transactions", headers={"Authorization": f"Bearer {token_b}"})
    summary_a = await client.get("/v1/transactions/summary", headers={"Authorization": f"Bearer {token_a}"})

    assert list_a.status_code == 200
    assert len(list_a.json()["transactions"]) == 1
    assert list_b.status_code == 200
    assert list_b.json()["transactions"] == []
    assert summary_a.status_code == 200
    assert summary_a.json()["category_totals"]["food_dining"] == "450.00"


async def test_upload_csv_and_deduplicate_reupload(client) -> None:
    token, _ = await _register_and_token(client, "upload@example.com")
    today = date.today().strftime("%d/%m/%Y")
    csv_payload = (
        "Transaction Date,Narration,Debit,Credit\n"
        f"{today},Swiggy order,450,\n"
        f"{today},Salary,,85000\n"
    ).encode()

    first = await client.post(
        "/v1/transactions/upload",
        headers={"Authorization": f"Bearer {token}"},
        data={"source": "bank_csv"},
        files={"file": ("statement.csv", csv_payload, "text/csv")},
    )
    second = await client.post(
        "/v1/transactions/upload",
        headers={"Authorization": f"Bearer {token}"},
        data={"source": "bank_csv"},
        files={"file": ("statement.csv", csv_payload, "text/csv")},
    )

    assert first.status_code == 200
    assert first.json()["successful"] == 2
    assert second.status_code == 200
    assert second.json()["successful"] == 0


async def test_transactions_require_authentication(client) -> None:
    response = await client.get("/v1/transactions")
    assert response.status_code == 401


async def test_upload_returns_422_when_no_transactions_detected(client) -> None:
    token, _ = await _register_and_token(client, "empty-upload@example.com")

    with patch("app.services.transaction_service.parse_transactions_file", return_value=([], [])):
        response = await client.post(
            "/v1/transactions/upload",
            headers={"Authorization": f"Bearer {token}"},
            data={"source": "bank_csv"},
            files={"file": ("statement.csv", b"Date,Description\n", "text/csv")},
        )

    assert response.status_code == 422
    assert "No supported transactions were detected" in response.json()["detail"]


async def test_upload_returns_422_for_password_protected_pdf(client) -> None:
    token, _ = await _register_and_token(client, "protected-pdf@example.com")

    with patch(
        "app.services.transaction_service.parse_transactions_file",
        side_effect=PdfPasswordRequiredError(
            "This PDF is password-protected. Enter the PDF password and upload again."
        ),
    ):
        response = await client.post(
            "/v1/transactions/upload",
            headers={"Authorization": f"Bearer {token}"},
            data={"source": "upi_statement"},
            files={"file": ("statement.pdf", b"%PDF-1.4", "application/pdf")},
        )

    assert response.status_code == 422
    assert "password-protected" in response.json()["detail"]


async def test_upload_passes_pdf_password_to_parser(client) -> None:
    token, _ = await _register_and_token(client, "pdf-password@example.com")

    with patch("app.services.transaction_service.parse_transactions_file", return_value=([], [])) as parse_mock:
        response = await client.post(
            "/v1/transactions/upload",
            headers={"Authorization": f"Bearer {token}"},
            data={"source": "upi_statement", "pdf_password": "123456"},
            files={"file": ("statement.pdf", b"%PDF-1.4", "application/pdf")},
        )

    assert response.status_code == 422
    assert parse_mock.call_args.kwargs["pdf_password"] == "123456"
