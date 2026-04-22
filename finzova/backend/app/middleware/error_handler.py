from __future__ import annotations

from http import HTTPStatus

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.errors import AppError


def _problem_payload(*, status_code: int, title: str, detail: str, instance: str, extra: dict | None = None) -> dict:
    payload = {
        "type": "about:blank",
        "title": title,
        "status": status_code,
        "detail": detail,
        "instance": instance,
    }
    if extra:
        payload.update(extra)
    return payload


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=_problem_payload(
            status_code=exc.status_code,
            title=exc.title,
            detail=exc.detail,
            instance=str(request.url.path),
            extra=exc.extra,
        ),
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    title = HTTPStatus(exc.status_code).phrase if exc.status_code in HTTPStatus._value2member_map_ else "HTTP Error"
    detail = exc.detail if isinstance(exc.detail, str) else "HTTP request failed"
    return JSONResponse(
        status_code=exc.status_code,
        content=_problem_payload(
            status_code=exc.status_code,
            title=title,
            detail=detail,
            instance=str(request.url.path),
        ),
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=_problem_payload(
            status_code=422,
            title="Request validation failed",
            detail="One or more request fields are invalid.",
            instance=str(request.url.path),
            extra={"errors": exc.errors()},
        ),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=_problem_payload(
            status_code=500,
            title="Internal Server Error",
            detail="An unexpected error occurred.",
            instance=str(request.url.path),
        ),
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

