from __future__ import annotations

from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class ProblemDetail(BaseModel):
    type: str = "about:blank"
    title: str
    status: int
    detail: str
    instance: str | None = None


class Pagination(BaseModel):
    total: int
    page: int
    limit: int
    pages: int


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    pagination: Pagination


class MessageResponse(BaseModel):
    message: str
    model_config = ConfigDict(extra="allow")


class ErrorContext(BaseModel):
    errors: list[dict[str, Any]] = Field(default_factory=list)

