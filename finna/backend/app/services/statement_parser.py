from __future__ import annotations

import csv
import io
import json
import os
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import openpyxl
import pdfplumber
from dateutil import parser as date_parser
from PIL import Image, ImageOps
from pdfplumber.utils.exceptions import PdfminerException
from rapidfuzz import fuzz, process

from app.config.constants import COLUMN_MAPPINGS, ExpenseCategory, ROW_SKIP_TOKENS, TransactionType
from app.config.security import mask_account_number


RUPEE_TOKENS_PATTERN = r"(?:₹|â‚¹|Ã¢â€šÂ¹|rs\.?|inr)"
PDF_LINE_PATTERN = re.compile(
    rf"^(?P<date>\d{{1,2}}[/-]\d{{1,2}}[/-]\d{{2,4}}|\d{{1,2}}\s+[A-Za-z]{{3,9}}\s+\d{{4}})\s+"
    rf"(?P<description>.+?)\s+"
    rf"(?P<amount>\(?{RUPEE_TOKENS_PATTERN}?\s?[\d,]+(?:\.\d{{1,2}})?\)?(?:\s*(?:CR|DR))?)$",
    flags=re.IGNORECASE,
)
PDF_LINE_WITH_BALANCE_PATTERN = re.compile(
    rf"^(?P<date>\d{{1,2}}[/-]\d{{1,2}}[/-]\d{{2,4}}|\d{{1,2}}\s+[A-Za-z]{{3,9}}\s+\d{{4}})\s+"
    rf"(?P<description>.+?)\s+"
    rf"(?P<amount>\(?{RUPEE_TOKENS_PATTERN}?\s?[\d,]+(?:\.\d{{1,2}})?\)?(?:\s*(?:CR|DR))?)\s+"
    rf"(?P<balance>\(?{RUPEE_TOKENS_PATTERN}?\s?[\d,]+(?:\.\d{{1,2}})?\)?(?:\s*(?:CR|DR))?)$",
    flags=re.IGNORECASE,
)
OCR_ROW_TOLERANCE = 14
OCR_DATE_COLUMN_MAX_X = 350
OCR_DESCRIPTION_COLUMN_MAX_X = 1300
OCR_DEBIT_COLUMN_MAX_X = 1700
OCR_CREDIT_COLUMN_MAX_X = 2000


@dataclass(slots=True)
class ParseFailure:
    row: int
    reason: str


@dataclass(slots=True)
class ParsedTransactionRow:
    row_number: int
    txn_date: date
    amount: Decimal
    merchant: str | None
    description: str | None
    txn_type: TransactionType
    source: str
    raw_data: dict[str, Any] = field(default_factory=dict)
    category: ExpenseCategory | None = None
    upi_id: str | None = None
    account_number: str | None = None


@dataclass(slots=True)
class ColumnMap:
    date: str
    merchant: str | None
    amount: str | None
    debit: str | None
    credit: str | None
    txn_type: str | None
    balance: str | None


@dataclass(slots=True)
class OcrLine:
    text: str
    x: float
    y: float


class StatementParseError(ValueError):
    pass


class PdfPasswordRequiredError(StatementParseError):
    pass


class InvalidPdfPasswordError(StatementParseError):
    pass


def sniff_delimiter(sample: str) -> str:
    delimiters = [",", ";", "\t", "|"]
    scores = {delimiter: sample.count(delimiter) for delimiter in delimiters}
    return max(scores, key=scores.get)


def normalize_header(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def parse_amount(value: Any) -> Decimal:
    if value is None:
        raise ValueError("Amount missing")

    if isinstance(value, Decimal):
        return abs(value)

    text = str(value).strip()
    if not text:
        raise ValueError("Amount missing")

    if text.startswith("(") and text.endswith(")"):
        text = text[1:-1]

    text = text.replace("₹", "")
    text = re.sub(r"\s*(?:CR|DR)\s*$", "", text, flags=re.IGNORECASE)
    text = re.sub(RUPEE_TOKENS_PATTERN, "", text, flags=re.IGNORECASE)
    text = text.replace(",", "").strip()

    if text.startswith("-"):
        text = text[1:]

    try:
        amount = Decimal(text)
    except InvalidOperation as exc:
        raise ValueError(f"Invalid amount '{value}'") from exc

    return abs(amount)


def detect_transaction_type(amount_value: Any, txn_type_value: Any = None) -> TransactionType | None:
    txn_text = str(txn_type_value or "").strip().lower()
    amount_text = str(amount_value or "").strip().lower()

    if txn_text in {"dr", "debit"}:
        return TransactionType.DEBIT
    if txn_text in {"cr", "credit"}:
        return TransactionType.CREDIT
    if amount_text.endswith("dr") or amount_text.startswith("-") or (amount_text.startswith("(") and amount_text.endswith(")")):
        return TransactionType.DEBIT
    if amount_text.endswith("cr"):
        return TransactionType.CREDIT
    return None


def parse_date_value(value: Any) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value

    text = str(value or "").strip()
    if not text:
        raise ValueError("Date missing")

    known_formats = [
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%Y-%m-%d",
        "%d %b %Y",
        "%d %B %Y",
        "%d/%m/%y",
        "%d-%m-%y",
    ]
    for fmt in known_formats:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue

    try:
        return date_parser.parse(text, dayfirst=True).date()
    except (ValueError, OverflowError) as exc:
        raise ValueError(f"Invalid date '{value}'") from exc


def map_columns(headers: list[str]) -> ColumnMap:
    normalized_headers = {header: normalize_header(header) for header in headers}

    def pick(canonical: str, threshold: int = 70, exclude: set[str] | None = None) -> str | None:
        aliases = COLUMN_MAPPINGS[canonical]
        best_score = 0
        best_header: str | None = None
        for header, normalized in normalized_headers.items():
            if exclude and header in exclude:
                continue
            match = process.extractOne(normalized, aliases, scorer=fuzz.partial_ratio)
            if match and match[1] > best_score:
                best_score = match[1]
                best_header = header
        return best_header if best_score >= threshold else None

    used_headers: set[str] = set()

    date_column = pick("date", threshold=75, exclude=used_headers)
    if not date_column:
        raise ValueError("Could not identify a date column")
    used_headers.add(date_column)

    amount_column = pick("amount", exclude=used_headers)
    if amount_column:
        used_headers.add(amount_column)

    debit_column = pick("debit", exclude=used_headers)
    if debit_column:
        used_headers.add(debit_column)

    credit_column = pick("credit", exclude=used_headers)
    if credit_column:
        used_headers.add(credit_column)

    merchant_column = pick("merchant", threshold=60, exclude=used_headers)
    if merchant_column:
        used_headers.add(merchant_column)

    txn_type_column = pick("txn_type", threshold=70, exclude=used_headers)
    if txn_type_column:
        used_headers.add(txn_type_column)

    balance_column = pick("balance", threshold=70, exclude=used_headers)

    if not amount_column and not (debit_column or credit_column):
        raise ValueError("Could not identify an amount column")

    return ColumnMap(
        date=date_column,
        merchant=merchant_column,
        amount=amount_column,
        debit=debit_column,
        credit=credit_column,
        txn_type=txn_type_column,
        balance=balance_column,
    )


def should_skip_row(values: list[Any]) -> bool:
    cleaned = [str(value).strip() for value in values if value not in (None, "")]
    if not cleaned:
        return True

    joined = " ".join(value.lower() for value in cleaned)
    if any(marker in joined for marker in ("opening balance", "closing balance", "available balance", "current balance")):
        return True

    if len(cleaned) <= 2 and any(token in joined for token in ROW_SKIP_TOKENS):
        return True

    return False


def extract_upi_id(text: str | None) -> str | None:
    if not text:
        return None
    match = re.search(r"\b(?:utr|ref)[\s:/-]*([a-z0-9]{6,})\b", text, flags=re.IGNORECASE)
    if not match:
        match = re.search(r"\b([a-z0-9.\-_]{3,}@[a-z]{3,})\b", text, flags=re.IGNORECASE)
    return match.group(1) if match else None


def _decode_delimited_bytes(file_bytes: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-16", "utf-16le", "utf-16be"):
        try:
            decoded = file_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue
        if decoded and ("\x00" not in decoded or encoding.startswith("utf-16")):
            return decoded

    return file_bytes.decode("utf-8-sig", errors="ignore")


def _rows_from_csv(file_bytes: bytes) -> list[list[Any]]:
    decoded = _decode_delimited_bytes(file_bytes)
    delimiter = sniff_delimiter(decoded[:4096])
    reader = csv.reader(io.StringIO(decoded), delimiter=delimiter)
    return [row for row in reader]


def _rows_from_xlsx(file_bytes: bytes) -> list[list[Any]]:
    workbook = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    sheet = workbook.active
    return [list(row) for row in sheet.iter_rows(values_only=True)]


def _locate_header(rows: list[list[Any]]) -> tuple[int, ColumnMap]:
    for index, row in enumerate(rows[:10]):
        headers = [str(value or "").strip() for value in row]
        if not any(headers):
            continue
        try:
            return index, map_columns(headers)
        except ValueError:
            continue
    raise ValueError("Could not locate a supported statement header row")


def _parse_optional_balance(value: Any) -> Decimal | None:
    if value in (None, "", 0, "0", "0.00"):
        return None
    return parse_amount(value)


def _parse_optional_amount(value: Any) -> Decimal | None:
    if value in (None, "", 0, "0", "0.00"):
        return None
    try:
        return parse_amount(value)
    except ValueError:
        return None


def _infer_tabular_balance_order(
    data_rows: list[tuple[int, dict[str, Any], Decimal | None, Decimal | None]],
) -> str | None:
    ascending_score = 0
    descending_score = 0

    for index in range(1, len(data_rows)):
        previous_balance = data_rows[index - 1][2]
        current_balance = data_rows[index][2]
        previous_amount = data_rows[index - 1][3]
        current_amount = data_rows[index][3]

        if previous_balance is None or current_balance is None:
            continue

        delta = previous_balance - current_balance
        if current_amount is not None and abs(delta) == current_amount:
            ascending_score += 1
        if previous_amount is not None and abs(delta) == previous_amount:
            descending_score += 1

    if ascending_score == 0 and descending_score == 0:
        return None
    return "ascending" if ascending_score >= descending_score else "descending"


def _infer_amount_and_type_from_balances(
    raw_amount: Any,
    *,
    previous_balance: Decimal | None = None,
    current_balance: Decimal | None = None,
    next_balance: Decimal | None = None,
    balance_order: str | None = None,
) -> tuple[Decimal, TransactionType] | None:
    if current_balance is None:
        return None

    amount = parse_amount(raw_amount)
    if previous_balance is not None and balance_order in {None, "ascending"}:
        delta = previous_balance - current_balance
        if delta != 0 and abs(delta) == amount:
            txn_type = TransactionType.DEBIT if delta > 0 else TransactionType.CREDIT
            return amount, txn_type

    if next_balance is not None and balance_order in {None, "descending"}:
        delta = current_balance - next_balance
        if delta != 0 and abs(delta) == amount:
            txn_type = TransactionType.CREDIT if delta > 0 else TransactionType.DEBIT
            return amount, txn_type

    return None


def _row_amount_and_type(
    row: dict[str, Any],
    column_map: ColumnMap,
    *,
    previous_balance: Decimal | None = None,
    current_balance: Decimal | None = None,
    next_balance: Decimal | None = None,
    balance_order: str | None = None,
) -> tuple[Decimal, TransactionType]:
    if column_map.debit or column_map.credit:
        debit_value = row.get(column_map.debit) if column_map.debit else None
        credit_value = row.get(column_map.credit) if column_map.credit else None
        if debit_value not in (None, "", 0, "0", "0.00"):
            return parse_amount(debit_value), TransactionType.DEBIT
        if credit_value not in (None, "", 0, "0", "0.00"):
            return parse_amount(credit_value), TransactionType.CREDIT

    if column_map.amount:
        raw_amount = row.get(column_map.amount)
        txn_type = detect_transaction_type(raw_amount, row.get(column_map.txn_type))
        if txn_type is None:
            inferred = _infer_amount_and_type_from_balances(
                raw_amount,
                previous_balance=previous_balance,
                current_balance=current_balance,
                next_balance=next_balance,
                balance_order=balance_order,
            )
            if inferred is None:
                raise ValueError("Transaction type is ambiguous for amount column")
            return inferred
        return parse_amount(raw_amount), txn_type

    raise ValueError("No usable amount column found")


def _parse_tabular_rows(rows: list[list[Any]], source: str) -> tuple[list[ParsedTransactionRow], list[ParseFailure]]:
    header_index, column_map = _locate_header(rows)
    headers = [str(value or "").strip() for value in rows[header_index]]
    parsed: list[ParsedTransactionRow] = []
    failures: list[ParseFailure] = []
    data_rows: list[tuple[int, dict[str, Any], Decimal | None, Decimal | None]] = []

    for offset, values in enumerate(rows[header_index + 1 :], start=header_index + 2):
        if should_skip_row(values):
            continue
        row = dict(zip(headers, values))
        current_balance: Decimal | None = None
        if column_map.balance:
            try:
                current_balance = _parse_optional_balance(row.get(column_map.balance))
            except ValueError:
                current_balance = None
        amount_hint = _parse_optional_amount(row.get(column_map.amount)) if column_map.amount else None
        data_rows.append((offset, row, current_balance, amount_hint))

    balance_order = _infer_tabular_balance_order(data_rows)

    for index, (offset, row, current_balance, _) in enumerate(data_rows):
        previous_balance = data_rows[index - 1][2] if index > 0 else None
        next_balance = data_rows[index + 1][2] if index + 1 < len(data_rows) else None
        try:
            amount, txn_type = _row_amount_and_type(
                row,
                column_map,
                previous_balance=previous_balance,
                current_balance=current_balance,
                next_balance=next_balance,
                balance_order=balance_order,
            )
            description = str(row.get(column_map.merchant) or "").strip() if column_map.merchant else None
            parsed.append(
                ParsedTransactionRow(
                    row_number=offset,
                    txn_date=parse_date_value(row[column_map.date]),
                    amount=amount,
                    merchant=description,
                    description=description,
                    txn_type=txn_type,
                    source=source,
                    raw_data={str(key): value for key, value in row.items()},
                    upi_id=extract_upi_id(description),
                    account_number=mask_account_number(description),
                )
            )
        except Exception as exc:
            failures.append(ParseFailure(row=offset, reason=str(exc)))

    return parsed, failures


def _normalize_ocr_date_text(value: str) -> str:
    normalized = str(value or "").strip()
    normalized = normalized.replace("O", "0").replace("o", "0")
    normalized = re.sub(r"(?<=\d)\s+(?=\d)", "", normalized)
    normalized = re.sub(r"\s*/\s*", "/", normalized)
    normalized = re.sub(r"\s*-\s*", "-", normalized)
    return normalized


def _normalize_ocr_amount_text(value: str) -> str:
    normalized = str(value or "").strip()
    normalized = normalized.replace("O", "0").replace("o", "0")
    normalized = normalized.replace("₹", "")
    normalized = re.sub(r"\s*\.\s*", ".", normalized)
    if "." not in normalized and re.search(r"\d\s+\d{2}\b", normalized):
        normalized = re.sub(r"\s+(\d{2})$", r".\1", normalized)
    normalized = re.sub(RUPEE_TOKENS_PATTERN, "", normalized, flags=re.IGNORECASE)
    normalized = normalized.replace(",", "")
    normalized = re.sub(r"\s+", "", normalized)
    return normalized


def _parse_ocr_balance_value(value: str) -> Decimal:
    normalized = str(value or "").strip()
    normalized = normalized.replace("O", "0").replace("o", "0")
    normalized = normalized.replace("₹", "")
    normalized = re.sub(r"\s*\.\s*", ".", normalized)
    normalized = re.sub(RUPEE_TOKENS_PATTERN, "", normalized, flags=re.IGNORECASE)
    normalized = normalized.replace(",", "")
    normalized = re.sub(r"\s+", "", normalized)
    if "." not in normalized and re.fullmatch(r"\d{3,}", normalized):
        normalized = f"{normalized[:-2]}.{normalized[-2:]}"
    return parse_amount(normalized)


def _ocr_backend_preference() -> str:
    return os.getenv("FINNA_OCR_BACKEND", "auto").strip().lower()


def _configure_tesseract_binary(pytesseract_module: Any) -> None:
    configured_path = os.getenv("FINNA_TESSERACT_CMD") or os.getenv("TESSERACT_CMD")
    if configured_path:
        pytesseract_module.pytesseract.tesseract_cmd = configured_path


def _prepare_image_for_ocr(image_path: Path) -> Image.Image:
    image = Image.open(image_path)
    image = image.convert("L")
    image = ImageOps.autocontrast(image)
    image = image.resize((image.width * 2, image.height * 2))
    image = image.point(lambda pixel: 255 if pixel > 180 else 0)
    return image


def _extract_ocr_lines_from_tesseract_data(data: dict[str, list[Any]]) -> list[OcrLine]:
    grouped_words: dict[tuple[int, int, int, int], list[tuple[int, int, str]]] = {}
    row_count = len(data.get("text", []))

    for index in range(row_count):
        word = str(data["text"][index] or "").strip()
        if not word:
            continue

        confidence_raw = str(data.get("conf", ["-1"] * row_count)[index]).strip()
        try:
            confidence = float(confidence_raw)
        except ValueError:
            confidence = -1
        if confidence < 20:
            continue

        key = (
            int(data.get("page_num", [1] * row_count)[index]),
            int(data.get("block_num", [0] * row_count)[index]),
            int(data.get("par_num", [0] * row_count)[index]),
            int(data.get("line_num", [index] * row_count)[index]),
        )
        grouped_words.setdefault(key, []).append(
            (
                int(data.get("left", [0] * row_count)[index]),
                int(data.get("top", [0] * row_count)[index]),
                word,
            )
        )

    lines: list[OcrLine] = []
    for key in sorted(grouped_words):
        words = sorted(grouped_words[key], key=lambda item: item[0])
        lines.append(
            OcrLine(
                text=" ".join(word for _, _, word in words),
                x=float(min(left for left, _, _ in words)),
                y=float(min(top for _, top, _ in words)),
            )
        )

    return lines


def _run_tesseract_ocr(image_path: Path) -> list[OcrLine]:
    try:
        import pytesseract
    except ImportError:
        return []

    _configure_tesseract_binary(pytesseract)

    try:
        image = _prepare_image_for_ocr(image_path)
        data = pytesseract.image_to_data(
            image,
            output_type=pytesseract.Output.DICT,
            config="--oem 3 --psm 6",
        )
    except Exception:
        return []

    return _extract_ocr_lines_from_tesseract_data(data)


def _group_ocr_lines_by_row(lines: list[OcrLine]) -> list[list[OcrLine]]:
    ordered = sorted(lines, key=lambda item: (item.y, item.x))
    grouped: list[list[OcrLine]] = []
    for line in ordered:
        if not grouped:
            grouped.append([line])
            continue
        previous_y = min(item.y for item in grouped[-1])
        if abs(line.y - previous_y) <= OCR_ROW_TOLERANCE:
            grouped[-1].append(line)
        else:
            grouped.append([line])

    for row in grouped:
        row.sort(key=lambda item: item.x)
    return grouped


def _infer_ocr_two_part_date_order(date_values: list[str]) -> str:
    pairs: list[tuple[int, int]] = []
    for raw_value in date_values:
        normalized = _normalize_ocr_date_text(raw_value)
        match = re.match(r"^(\d{1,2})[/-](\d{1,2})$", normalized)
        if not match:
            continue
        pairs.append((int(match.group(1)), int(match.group(2))))

    if not pairs:
        return "day_first"

    unique_first = len({first for first, _ in pairs})
    unique_second = len({second for _, second in pairs})
    return "month_first" if unique_first < unique_second else "day_first"


def _parse_ocr_date_value(value: str, inferred_order: str) -> date:
    normalized = _normalize_ocr_date_text(value)
    match = re.match(r"^(\d{1,2})([/-])(\d{1,2})$", normalized)
    if not match:
        return parse_date_value(normalized)

    first, separator, second = match.groups()
    current_year = date.today().year
    format_prefix = "%m" if inferred_order == "month_first" else "%d"
    format_suffix = "%d" if inferred_order == "month_first" else "%m"
    fmt = f"{format_prefix}{separator}{format_suffix}{separator}%Y"
    return datetime.strptime(f"{first}{separator}{second}{separator}{current_year}", fmt).date()


def _looks_like_ocr_date(value: str) -> bool:
    normalized = _normalize_ocr_date_text(value)
    return bool(
        re.match(r"^\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?$", normalized)
        or re.match(r"^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}$", normalized)
    )


def _ocr_cluster_to_cells(cluster: list[OcrLine]) -> dict[str, str | None]:
    cells: dict[str, str | None] = {
        "date": None,
        "description": None,
        "debit": None,
        "credit": None,
        "balance": None,
    }
    for line in cluster:
        if line.x < OCR_DATE_COLUMN_MAX_X:
            cells["date"] = line.text
        elif line.x < OCR_DESCRIPTION_COLUMN_MAX_X:
            cells["description"] = line.text
        elif line.x < OCR_DEBIT_COLUMN_MAX_X:
            cells["debit"] = line.text
        elif line.x < OCR_CREDIT_COLUMN_MAX_X:
            cells["credit"] = line.text
        else:
            cells["balance"] = line.text
    return cells


def _parse_transactions_from_ocr_lines(
    lines: list[OcrLine],
    source: str,
    *,
    row_number_offset: int = 0,
) -> tuple[list[ParsedTransactionRow], list[ParseFailure]]:
    clusters = _group_ocr_lines_by_row(lines)
    header_index: int | None = None
    for index, cluster in enumerate(clusters):
        header_text = " ".join(item.text.lower() for item in cluster)
        if "date" in header_text and "description" in header_text and "balance" in header_text:
            header_index = index
            break

    if header_index is None:
        return [], []

    raw_rows: list[dict[str, Any]] = []
    for relative_index, cluster in enumerate(clusters[header_index + 1 :], start=header_index + 2):
        cells = _ocr_cluster_to_cells(cluster)
        description = (cells["description"] or "").strip()
        date_text = (cells["date"] or "").strip()
        if not date_text and not description:
            continue
        if not _looks_like_ocr_date(date_text):
            continue
        raw_rows.append(
            {
                "row_number": row_number_offset + relative_index,
                "date": date_text,
                "description": description,
                "debit": cells["debit"],
                "credit": cells["credit"],
                "balance": cells["balance"],
            }
        )

    inferred_order = _infer_ocr_two_part_date_order([row["date"] for row in raw_rows])
    parsed: list[ParsedTransactionRow] = []
    failures: list[ParseFailure] = []
    previous_balance: Decimal | None = None

    for row in raw_rows:
        try:
            description = row["description"] or None
            if not description:
                raise ValueError("Description missing from OCR row")

            current_balance: Decimal | None = None
            if row["balance"]:
                current_balance = _parse_ocr_balance_value(str(row["balance"]))

            amount: Decimal | None = None
            txn_type: TransactionType | None = None
            amount_text = row["debit"] or row["credit"]
            if amount_text:
                txn_type = TransactionType.DEBIT if row["debit"] else TransactionType.CREDIT
                amount = parse_amount(_normalize_ocr_amount_text(str(amount_text)))
            elif current_balance is not None and previous_balance is not None:
                delta = previous_balance - current_balance
                if delta != 0:
                    txn_type = TransactionType.DEBIT if delta > 0 else TransactionType.CREDIT
                    amount = abs(delta)

            if amount is None or txn_type is None:
                previous_balance = current_balance if current_balance is not None else previous_balance
                continue

            parsed.append(
                ParsedTransactionRow(
                    row_number=row["row_number"],
                    txn_date=_parse_ocr_date_value(row["date"], inferred_order),
                    amount=amount,
                    merchant=description,
                    description=description,
                    txn_type=txn_type,
                    source=source,
                    raw_data=row,
                    upi_id=extract_upi_id(description),
                    account_number=mask_account_number(description),
                )
            )
            previous_balance = current_balance if current_balance is not None else previous_balance
        except Exception as exc:
            failures.append(ParseFailure(row=row["row_number"], reason=str(exc)))

    return parsed, failures


def _ocr_vendor_dir() -> Path:
    return Path(__file__).resolve().parents[2] / ".ocr_vendor_py310"


def _ocr_bridge_script() -> Path:
    return Path(__file__).with_name("windows_ocr_bridge.py")


def _windows_ocr_command_candidates() -> list[list[str]]:
    candidates: list[list[str]] = []
    configured = os.getenv("FINNA_OCR_PYTHON")
    if configured:
        candidates.append([configured])

    system_python = shutil.which("python")
    if system_python:
        candidates.append([system_python])

    py_launcher = shutil.which("py")
    if py_launcher:
        candidates.append([py_launcher, "-3.10"])

    unique_candidates: list[list[str]] = []
    seen = set()
    for candidate in candidates:
        key = tuple(candidate)
        if key not in seen:
            seen.add(key)
            unique_candidates.append(candidate)
    return unique_candidates


def _run_windows_ocr(image_path: Path) -> list[OcrLine]:
    vendor_dir = _ocr_vendor_dir()
    bridge_script = _ocr_bridge_script()
    if not vendor_dir.exists() or not bridge_script.exists():
        return []

    environment = os.environ.copy()
    existing_pythonpath = environment.get("PYTHONPATH")
    pythonpath_parts = [str(vendor_dir)]
    if existing_pythonpath:
        pythonpath_parts.append(existing_pythonpath)
    environment["PYTHONPATH"] = os.pathsep.join(pythonpath_parts)

    for candidate in _windows_ocr_command_candidates():
        try:
            result = subprocess.run(
                [*candidate, str(bridge_script), str(image_path)],
                capture_output=True,
                text=True,
                timeout=45,
                check=False,
                env=environment,
            )
        except (FileNotFoundError, subprocess.SubprocessError):
            continue

        if result.returncode != 0 or not result.stdout.strip():
            continue

        try:
            payload = json.loads(result.stdout)
        except json.JSONDecodeError:
            continue

        return [
            OcrLine(
                text=str(item.get("text", "")).strip(),
                x=float(item.get("x", 0)),
                y=float(item.get("y", 0)),
            )
            for item in payload
            if str(item.get("text", "")).strip()
        ]

    return []


def _run_ocr_for_image(image_path: Path) -> list[OcrLine]:
    backend = _ocr_backend_preference()
    if backend in {"auto", "tesseract"}:
        tesseract_lines = _run_tesseract_ocr(image_path)
        if tesseract_lines or backend == "tesseract":
            return tesseract_lines

    if backend in {"auto", "windows"} and os.name == "nt":
        windows_lines = _run_windows_ocr(image_path)
        if windows_lines or backend == "windows":
            return windows_lines

    return []


def _open_pdf_document(file_bytes: bytes, password: str | None = None):
    try:
        return pdfplumber.open(io.BytesIO(file_bytes), password=password or None)
    except PdfminerException as exc:
        inner_exception = exc.__cause__ or exc.__context__
        cause_name = inner_exception.__class__.__name__ if inner_exception else ""
        detail = (str(exc) or str(inner_exception) or "").lower()
        if cause_name == "PDFPasswordIncorrect" or "password" in detail or "encrypted" in detail:
            if password:
                raise InvalidPdfPasswordError("The provided PDF password is incorrect.") from exc
            raise PdfPasswordRequiredError(
                "This PDF is password-protected. Enter the PDF password and upload again."
            ) from exc
        raise StatementParseError("The uploaded PDF could not be parsed.") from exc


def _parse_pdf_rows_via_ocr(
    file_bytes: bytes,
    source: str,
    password: str | None = None,
) -> tuple[list[ParsedTransactionRow], list[ParseFailure]]:
    parsed: list[ParsedTransactionRow] = []
    failures: list[ParseFailure] = []

    with tempfile.TemporaryDirectory(prefix="finna-ocr-") as temp_directory:
        temp_path = Path(temp_directory)
        with _open_pdf_document(file_bytes, password=password) as pdf:
            for page_index, page in enumerate(pdf.pages, start=1):
                if not hasattr(page, "to_image"):
                    continue
                page_image = page.to_image(resolution=300)
                image_path = temp_path / f"page-{page_index}.png"
                page_image.save(image_path, format="PNG")

                ocr_lines = _run_ocr_for_image(image_path)
                page_parsed, page_failures = _parse_transactions_from_ocr_lines(
                    ocr_lines,
                    source,
                    row_number_offset=page_index * 1000,
                )
                parsed.extend(page_parsed)
                failures.extend(page_failures)

    return parsed, failures


def _parse_pdf_rows(
    file_bytes: bytes,
    source: str,
    password: str | None = None,
) -> tuple[list[ParsedTransactionRow], list[ParseFailure]]:
    with _open_pdf_document(file_bytes, password=password) as pdf:
        table_rows: list[list[Any]] = []
        lines: list[str] = []
        for page in pdf.pages:
            for table in page.extract_tables() or []:
                table_rows.extend(table)

            text = page.extract_text() or ""
            lines.extend(line.strip() for line in text.splitlines() if line.strip())

    table_failures: list[ParseFailure] = []

    if table_rows:
        try:
            parsed_from_tables, failures_from_tables = _parse_tabular_rows(table_rows, source)
            if parsed_from_tables:
                return parsed_from_tables, failures_from_tables
            table_failures = failures_from_tables
        except ValueError:
            pass

    parsed: list[ParsedTransactionRow] = []
    failures: list[ParseFailure] = []
    raw_line_rows: list[tuple[int, str, str, str, Decimal | None, Decimal | None]] = []

    for index, line in enumerate(lines, start=1):
        match = PDF_LINE_WITH_BALANCE_PATTERN.match(line) or PDF_LINE_PATTERN.match(line)
        if not match:
            continue
        amount_text = match.group("amount")
        balance_text = match.groupdict().get("balance")
        raw_line_rows.append(
            (
                index,
                match.group("date"),
                match.group("description").strip(),
                amount_text,
                _parse_optional_balance(balance_text) if balance_text else None,
                _parse_optional_amount(amount_text),
            )
        )

    line_balance_order = _infer_tabular_balance_order(
        [
            (
                row_number,
                {"description": description, "amount": amount_text, "balance": balance},
                balance,
                amount_hint,
            )
            for row_number, _, description, amount_text, balance, amount_hint in raw_line_rows
        ]
    )

    for index, (row_number, date_text, description, amount_text, current_balance, _) in enumerate(raw_line_rows):
        previous_balance = raw_line_rows[index - 1][4] if index > 0 else None
        next_balance = raw_line_rows[index + 1][4] if index + 1 < len(raw_line_rows) else None
        try:
            txn_type = detect_transaction_type(amount_text)
            if txn_type is None:
                inferred = _infer_amount_and_type_from_balances(
                    amount_text,
                    previous_balance=previous_balance,
                    current_balance=current_balance,
                    next_balance=next_balance,
                    balance_order=line_balance_order,
                )
                if inferred is None:
                    raise ValueError("Could not determine transaction type from PDF line")
                amount, txn_type = inferred
            else:
                amount = parse_amount(amount_text)
            parsed.append(
                ParsedTransactionRow(
                    row_number=row_number,
                    txn_date=parse_date_value(date_text),
                    amount=amount,
                    merchant=description,
                    description=description,
                    txn_type=txn_type,
                    source=source,
                    raw_data={"line": lines[row_number - 1]},
                    upi_id=extract_upi_id(description),
                    account_number=mask_account_number(description),
                )
            )
        except Exception as exc:
            failures.append(ParseFailure(row=row_number, reason=str(exc)))

    if parsed:
        return parsed, failures

    parsed_from_ocr, failures_from_ocr = _parse_pdf_rows_via_ocr(file_bytes, source, password=password)
    if parsed_from_ocr:
        return parsed_from_ocr, failures_from_ocr
    if failures_from_ocr:
        return parsed_from_ocr, failures_from_ocr

    if failures:
        return parsed, failures

    return parsed, table_failures


def parse_transactions_file(
    filename: str,
    file_bytes: bytes,
    source: str,
    pdf_password: str | None = None,
) -> tuple[list[ParsedTransactionRow], list[ParseFailure]]:
    suffix = filename.rsplit(".", 1)[-1].lower()
    if suffix == "csv":
        return _parse_tabular_rows(_rows_from_csv(file_bytes), source)
    if suffix == "xlsx":
        return _parse_tabular_rows(_rows_from_xlsx(file_bytes), source)
    if suffix == "pdf":
        return _parse_pdf_rows(file_bytes, source, password=pdf_password)
    raise ValueError(f"Unsupported file type: {suffix}")
