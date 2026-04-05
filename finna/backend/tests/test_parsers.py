from __future__ import annotations

import io
from datetime import date
from decimal import Decimal

import openpyxl

from app.config.constants import TransactionType
from app.services.statement_parser import OcrLine, ParsedTransactionRow, parse_amount, parse_date_value, parse_transactions_file
from app.services.statement_parser import _extract_ocr_lines_from_tesseract_data
from app.services.statement_parser import _parse_transactions_from_ocr_lines


def test_parse_amount_variants() -> None:
    assert parse_amount("₹1,234.50") == Decimal("1234.50")
    assert parse_amount("INR 1,234.50") == Decimal("1234.50")
    assert parse_amount("(999.00)") == Decimal("999.00")
    assert parse_amount("450 DR") == Decimal("450")


def test_parse_date_variants() -> None:
    assert parse_date_value("27/03/2026") == date(2026, 3, 27)
    assert parse_date_value("27 Mar 2026") == date(2026, 3, 27)
    assert parse_date_value("2026-03-27") == date(2026, 3, 27)


def test_parse_csv_statement() -> None:
    file_bytes = (
        "Transaction Date,Narration,Debit,Credit\n"
        "27/03/2026,Swiggy order,450,\n"
        "28/03/2026,Salary,,85000\n"
    ).encode()

    rows, failures = parse_transactions_file("statement.csv", file_bytes, "bank_csv")

    assert len(rows) == 2
    assert not failures
    assert rows[0].txn_type == TransactionType.DEBIT
    assert rows[1].txn_type == TransactionType.CREDIT


def test_parse_xlsx_statement() -> None:
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.append(["Date", "Description", "Debit", "Credit"])
    sheet.append(["27/03/2026", "Netflix subscription", 649, None])
    sheet.append(["28/03/2026", "Salary", None, 85000])

    buffer = io.BytesIO()
    workbook.save(buffer)

    rows, failures = parse_transactions_file("statement.xlsx", buffer.getvalue(), "bank_csv")

    assert len(rows) == 2
    assert not failures
    assert rows[0].merchant == "Netflix subscription"


def test_parse_pdf_statement(monkeypatch) -> None:
    class FakePage:
        def extract_tables(self):
            return []

        def extract_text(self) -> str:
            return "27 Mar 2026 UPI SWIGGY REF123456 ₹450 DR\n28 Mar 2026 SALARY CREDIT ₹85000 CR"

    class FakePDF:
        pages = [FakePage()]

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    monkeypatch.setattr("app.services.statement_parser.pdfplumber.open", lambda *args, **kwargs: FakePDF())

    rows, failures = parse_transactions_file("statement.pdf", b"%PDF-1.4", "upi_statement")

    assert len(rows) == 2
    assert not failures
    assert rows[0].upi_id == "123456"


def test_parse_pdf_statement_from_table(monkeypatch) -> None:
    class FakePage:
        def extract_tables(self):
            return [
                [
                    ["Transaction Date", "Narration", "Debit", "Credit", "Closing Balance"],
                    ["27/03/2026", "Swiggy order", "₹450", "", "₹10,550"],
                    ["28/03/2026", "Salary", "", "₹85,000", "₹95,550"],
                ]
            ]

        def extract_text(self) -> str:
            return ""

    class FakePDF:
        pages = [FakePage()]

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    monkeypatch.setattr("app.services.statement_parser.pdfplumber.open", lambda *args, **kwargs: FakePDF())

    rows, failures = parse_transactions_file("statement.pdf", b"%PDF-1.4", "bank_csv")

    assert len(rows) == 2
    assert not failures
    assert rows[0].txn_type == TransactionType.DEBIT
    assert rows[1].txn_type == TransactionType.CREDIT


def test_parse_pdf_statement_from_amount_and_balance_table(monkeypatch) -> None:
    class FakePage:
        def extract_tables(self):
            return [
                [
                    ["Date", "Narration", "Amount", "Balance"],
                    ["29/03/2026", "Salary credit", "85,000.00", "95,550.00"],
                    ["28/03/2026", "Swiggy order", "450.00", "10,550.00"],
                    ["27/03/2026", "ATM withdrawal", "100 DR", "11,000.00"],
                ]
            ]

        def extract_text(self) -> str:
            return ""

    class FakePDF:
        pages = [FakePage()]

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    monkeypatch.setattr("app.services.statement_parser.pdfplumber.open", lambda *args, **kwargs: FakePDF())

    rows, failures = parse_transactions_file("statement.pdf", b"%PDF-1.4", "bank_csv")

    assert len(rows) == 3
    assert not failures
    assert rows[0].txn_type == TransactionType.CREDIT
    assert rows[0].amount == Decimal("85000.00")
    assert rows[1].txn_type == TransactionType.DEBIT
    assert rows[1].amount == Decimal("450.00")
    assert rows[2].txn_type == TransactionType.DEBIT
    assert rows[2].amount == Decimal("100.00")


def test_parse_pdf_statement_falls_back_from_bad_table_to_text(monkeypatch) -> None:
    class FakePage:
        def extract_tables(self):
            return [
                [
                    ["Date", "Narration", "Amount"],
                    ["29/03/2026", "Salary credit", "85000.00"],
                    ["28/03/2026", "Swiggy order", "450.00"],
                ]
            ]

        def extract_text(self) -> str:
            return "29 Mar 2026 SALARY CREDIT 85000 CR\n28 Mar 2026 SWIGGY ORDER 450 DR"

    class FakePDF:
        pages = [FakePage()]

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    monkeypatch.setattr("app.services.statement_parser.pdfplumber.open", lambda *args, **kwargs: FakePDF())

    rows, failures = parse_transactions_file("statement.pdf", b"%PDF-1.4", "bank_csv")

    assert len(rows) == 2
    assert not failures
    assert rows[0].txn_type == TransactionType.CREDIT
    assert rows[1].txn_type == TransactionType.DEBIT


def test_parse_pdf_statement_falls_back_from_bad_text_to_ocr(monkeypatch) -> None:
    class FakePage:
        def extract_tables(self):
            return []

        def extract_text(self) -> str:
            return "29/03/2026 SALARY CREDIT 85000\n28/03/2026 SWIGGY ORDER 450"

    class FakePDF:
        pages = [FakePage()]

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    monkeypatch.setattr("app.services.statement_parser.pdfplumber.open", lambda *args, **kwargs: FakePDF())
    monkeypatch.setattr(
        "app.services.statement_parser._parse_pdf_rows_via_ocr",
        lambda *args, **kwargs: (
            [
                ParsedTransactionRow(
                    row_number=1001,
                    txn_date=date(2026, 3, 29),
                    amount=Decimal("85000.00"),
                    merchant="SALARY CREDIT",
                    description="SALARY CREDIT",
                    txn_type=TransactionType.CREDIT,
                    source="bank_csv",
                )
            ],
            [],
        ),
    )

    rows, failures = parse_transactions_file("statement.pdf", b"%PDF-1.4", "bank_csv")

    assert len(rows) == 1
    assert not failures
    assert rows[0].txn_type == TransactionType.CREDIT


def test_parse_scanned_pdf_ocr_lines() -> None:
    lines = [
        OcrLine(text="Date", x=270, y=2317),
        OcrLine(text="Description", x=382, y=2317),
        OcrLine(text="Debit", x=1394, y=2317),
        OcrLine(text="Credit", x=1768, y=2317),
        OcrLine(text="Balance", x=2107, y=2317),
        OcrLine(text="1 0/02", x=271, y=2357),
        OcrLine(text="POS PURCHASE", x=382, y=2357),
        OcrLine(text="4.23", x=1412, y=2357),
        OcrLine(text="65 73", x=2143, y=2357),
        OcrLine(text="1 0/03", x=271, y=2397),
        OcrLine(text="PREAUTHORIZED CREDIT", x=382, y=2397),
        OcrLine(text="763.01", x=1759, y=2397),
        OcrLine(text="828.74", x=2125, y=2397),
    ]

    rows, failures = _parse_transactions_from_ocr_lines(lines, "bank_csv")

    assert len(rows) == 2
    assert not failures
    assert rows[0].txn_type == TransactionType.DEBIT
    assert rows[0].amount == Decimal("4.23")
    assert rows[0].txn_date.month == 10
    assert rows[0].txn_date.day == 2
    assert rows[1].txn_type == TransactionType.CREDIT
    assert rows[1].merchant == "PREAUTHORIZED CREDIT"


def test_extract_ocr_lines_from_tesseract_data() -> None:
    data = {
        "text": ["Date", "Description", "10/02", "POS", "PURCHASE", "4.23"],
        "conf": ["95", "95", "92", "88", "90", "93"],
        "page_num": [1, 1, 1, 1, 1, 1],
        "block_num": [1, 1, 2, 2, 2, 2],
        "par_num": [1, 1, 1, 1, 1, 1],
        "line_num": [1, 1, 1, 1, 1, 1],
        "left": [20, 140, 20, 140, 220, 520],
        "top": [10, 10, 40, 40, 40, 40],
    }

    lines = _extract_ocr_lines_from_tesseract_data(data)

    assert len(lines) == 2
    assert lines[0].text == "Date Description"
    assert lines[1].text == "10/02 POS PURCHASE 4.23"
    assert lines[1].x == 20
