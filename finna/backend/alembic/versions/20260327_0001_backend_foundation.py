"""backend foundation schema

Revision ID: 20260327_0001
Revises:
Create Date: 2026-03-27 22:30:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260327_0001"
down_revision = None
branch_labels = None
depends_on = None


transaction_type_enum = postgresql.ENUM("credit", "debit", name="transaction_type")
expense_category_enum = postgresql.ENUM(
    "food_dining",
    "transport",
    "shopping",
    "subscriptions",
    "utilities",
    "rent_housing",
    "healthcare",
    "education",
    "entertainment",
    "investments",
    "insurance",
    "emi_loans",
    "transfers",
    "salary_income",
    "freelance_income",
    "interest_income",
    "cashback_rewards",
    "groceries",
    "personal_care",
    "travel",
    "gifts_donations",
    "taxes",
    "miscellaneous",
    "uncategorized",
    name="expense_category",
)
risk_level_enum = postgresql.ENUM("critical", "high", "medium", "low", "safe", name="risk_level")
goal_type_enum = postgresql.ENUM(
    "emergency_fund",
    "vehicle",
    "home",
    "education",
    "retirement",
    "vacation",
    "wedding",
    "investment",
    "debt_payoff",
    "custom",
    name="goal_type",
)
goal_status_enum = postgresql.ENUM("active", "completed", "abandoned", "paused", name="goal_status")
alert_type_enum = postgresql.ENUM(
    "overspending",
    "debt_risk",
    "low_emergency_fund",
    "unusual_transaction",
    "goal_at_risk",
    "income_drop",
    "subscription_creep",
    "tax_saving_opportunity",
    name="alert_type",
)
alert_severity_enum = postgresql.ENUM("critical", "warning", "info", name="alert_severity")


def _create_rls_policies(table_name: str, owner_column: str) -> None:
    for action in ("SELECT", "UPDATE", "DELETE"):
        op.execute(
            sa.text(
                f"""
                CREATE POLICY {table_name}_{action.lower()}_own
                ON public.{table_name}
                FOR {action}
                USING ({owner_column} = current_setting('app.current_user_id', true)::uuid)
                """
            )
        )

    op.execute(
        sa.text(
            f"""
            CREATE POLICY {table_name}_insert_own
            ON public.{table_name}
            FOR INSERT
            WITH CHECK ({owner_column} = current_setting('app.current_user_id', true)::uuid)
            """
        )
    )


def upgrade() -> None:
    bind = op.get_bind()
    op.execute(sa.text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))

    transaction_type_enum.create(bind, checkfirst=True)
    expense_category_enum.create(bind, checkfirst=True)
    risk_level_enum.create(bind, checkfirst=True)
    goal_type_enum.create(bind, checkfirst=True)
    goal_status_enum.create(bind, checkfirst=True)
    alert_type_enum.create(bind, checkfirst=True)
    alert_severity_enum.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("monthly_income", sa.Numeric(15, 2), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default=sa.text("'INR'")),
        sa.Column("tax_regime", sa.String(length=10), nullable=False, server_default=sa.text("'new'")),
        sa.Column("onboarding_done", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["id"], ["auth.users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        schema="public",
    )
    op.create_index("idx_users_email", "users", ["email"], unique=False, schema="public")

    op.create_table(
        "transactions",
        sa.Column("transaction_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("merchant", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", expense_category_enum, nullable=False, server_default=sa.text("'uncategorized'")),
        sa.Column("txn_type", transaction_type_enum, nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=True),
        sa.Column("upi_id", sa.String(length=255), nullable=True),
        sa.Column("account_number", sa.String(length=20), nullable=True),
        sa.Column("is_recurring", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("confidence", sa.Numeric(3, 2), nullable=True),
        sa.Column("raw_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("dedupe_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["public.users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("transaction_id"),
        sa.UniqueConstraint("dedupe_hash"),
        schema="public",
    )
    op.create_index("idx_txn_user_date", "transactions", ["user_id", "date"], unique=False, schema="public")
    op.create_index("idx_txn_category", "transactions", ["user_id", "category"], unique=False, schema="public")
    op.create_index("idx_txn_type", "transactions", ["user_id", "txn_type"], unique=False, schema="public")
    op.create_index("idx_txn_merchant", "transactions", ["merchant"], unique=False, schema="public")

    op.create_table(
        "goals",
        sa.Column("goal_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("goal_type", goal_type_enum, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("target_amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("current_amount", sa.Numeric(15, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("timeline_months", sa.Integer(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False, server_default=sa.text("CURRENT_DATE")),
        sa.Column("target_date", sa.Date(), nullable=False),
        sa.Column("monthly_required", sa.Numeric(15, 2), nullable=True),
        sa.Column("success_probability", sa.Numeric(5, 2), nullable=True),
        sa.Column("status", goal_status_enum, nullable=False, server_default=sa.text("'active'")),
        sa.Column("simulation_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["public.users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("goal_id"),
        schema="public",
    )
    op.create_index("idx_goals_user", "goals", ["user_id", "status"], unique=False, schema="public")

    op.create_table(
        "analysis_results",
        sa.Column("analysis_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("financial_score", sa.Integer(), nullable=False),
        sa.Column("risk_level", risk_level_enum, nullable=False),
        sa.Column("metrics", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("recommendations", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("agent_traces", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["public.users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("analysis_id"),
        sa.CheckConstraint("financial_score BETWEEN 0 AND 100", name="analysis_results_financial_score_range"),
        schema="public",
    )
    op.create_index("idx_analysis_user", "analysis_results", ["user_id", "created_at"], unique=False, schema="public")

    op.create_table(
        "risk_alerts",
        sa.Column("alert_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("alert_type", alert_type_enum, nullable=False),
        sa.Column("severity", alert_severity_enum, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_resolved", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["public.users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("alert_id"),
        schema="public",
    )
    op.create_index("idx_alerts_user", "risk_alerts", ["user_id", "is_resolved", "created_at"], unique=False, schema="public")

    op.create_table(
        "chat_messages",
        sa.Column("message_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=10), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("agent_reasoning", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("tools_used", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["public.users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("message_id"),
        sa.CheckConstraint("role IN ('user', 'assistant', 'system')", name="chat_messages_role_check"),
        schema="public",
    )
    op.create_index("idx_chat_user_session", "chat_messages", ["user_id", "session_id", "created_at"], unique=False, schema="public")

    for table_name in ("users", "transactions", "goals", "analysis_results", "risk_alerts", "chat_messages"):
        op.execute(sa.text(f"ALTER TABLE public.{table_name} ENABLE ROW LEVEL SECURITY"))

    _create_rls_policies("users", "id")
    _create_rls_policies("transactions", "user_id")
    _create_rls_policies("goals", "user_id")
    _create_rls_policies("analysis_results", "user_id")
    _create_rls_policies("risk_alerts", "user_id")
    _create_rls_policies("chat_messages", "user_id")


def downgrade() -> None:
    for table_name in ("chat_messages", "risk_alerts", "analysis_results", "goals", "transactions", "users"):
        for suffix in ("select_own", "update_own", "delete_own", "insert_own"):
            op.execute(sa.text(f"DROP POLICY IF EXISTS {table_name}_{suffix} ON public.{table_name}"))

    op.drop_index("idx_chat_user_session", table_name="chat_messages", schema="public")
    op.drop_table("chat_messages", schema="public")

    op.drop_index("idx_alerts_user", table_name="risk_alerts", schema="public")
    op.drop_table("risk_alerts", schema="public")

    op.drop_index("idx_analysis_user", table_name="analysis_results", schema="public")
    op.drop_table("analysis_results", schema="public")

    op.drop_index("idx_goals_user", table_name="goals", schema="public")
    op.drop_table("goals", schema="public")

    op.drop_index("idx_txn_merchant", table_name="transactions", schema="public")
    op.drop_index("idx_txn_type", table_name="transactions", schema="public")
    op.drop_index("idx_txn_category", table_name="transactions", schema="public")
    op.drop_index("idx_txn_user_date", table_name="transactions", schema="public")
    op.drop_table("transactions", schema="public")

    op.drop_index("idx_users_email", table_name="users", schema="public")
    op.drop_table("users", schema="public")

    bind = op.get_bind()
    alert_severity_enum.drop(bind, checkfirst=True)
    alert_type_enum.drop(bind, checkfirst=True)
    goal_status_enum.drop(bind, checkfirst=True)
    goal_type_enum.drop(bind, checkfirst=True)
    risk_level_enum.drop(bind, checkfirst=True)
    expense_category_enum.drop(bind, checkfirst=True)
    transaction_type_enum.drop(bind, checkfirst=True)
