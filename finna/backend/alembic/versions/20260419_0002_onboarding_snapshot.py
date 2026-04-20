"""add onboarding_snapshot column to users

Revision ID: 20260419_0002
Revises: 20260327_0001
Create Date: 2026-04-19 10:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260419_0002"
down_revision = "20260327_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "onboarding_snapshot",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        schema="public",
    )


def downgrade() -> None:
    op.drop_column("users", "onboarding_snapshot", schema="public")
