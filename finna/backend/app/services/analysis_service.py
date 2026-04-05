from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base_agent import AgentContext
from app.agents.orchestrator import OrchestratorAgent
from app.config.constants import GoalStatus
from app.models.analysis import AnalysisResult
from app.models.goal import Goal
from app.models.risk_alert import RiskAlert
from app.models.transaction import Transaction
from app.models.user import User
from app.tools.financial_metrics import build_health_breakdown, calculate_health_score, compute_financial_metrics
from app.tools.goal_simulator import simulate_goal
from app.tools.risk_rules import derive_risk_level, detect_risk_alerts, make_recommendations


class AnalysisService:
    MIN_BENCHMARK_USERS = 10

    def __init__(self, orchestrator: OrchestratorAgent) -> None:
        self.orchestrator = orchestrator

    async def _load_context(self, session: AsyncSession, user: User) -> tuple[list[Transaction], list[Goal]]:
        transactions = (
            await session.execute(
                select(Transaction)
                .where(Transaction.user_id == user.id)
                .order_by(Transaction.date.desc(), Transaction.created_at.desc())
            )
        ).scalars().all()
        goals = (
            await session.execute(
                select(Goal).where(Goal.user_id == user.id, Goal.status == GoalStatus.ACTIVE)
            )
        ).scalars().all()
        return transactions, goals

    async def run_analysis(
        self,
        *,
        session: AsyncSession,
        user: User,
        force_refresh: bool = False,
    ) -> AnalysisResult:
        latest = await session.scalar(
            select(AnalysisResult)
            .where(AnalysisResult.user_id == user.id)
            .order_by(AnalysisResult.created_at.desc())
        )
        if latest and not force_refresh and latest.created_at >= datetime.utcnow() - timedelta(hours=24):
            return latest

        transactions, goals = await self._load_context(session, user)
        metrics = compute_financial_metrics(transactions)
        goal_snapshots = []
        average_monthly_saving = max(Decimal("0.00"), (metrics.total_income - metrics.total_expenses) / max(1, len(metrics.monthly_trends) or 1))
        for goal in goals:
            simulation = simulate_goal(
                target_amount=Decimal(goal.target_amount),
                current_amount=Decimal(goal.current_amount),
                timeline_months=goal.timeline_months,
                monthly_saving=average_monthly_saving,
            )
            goal.success_probability = Decimal(str(round(simulation.success_probability, 2)))
            goal.monthly_required = simulation.monthly_required
            goal.simulation_data = simulation.to_dict()
            goal_snapshots.append(
                {
                    "title": goal.title,
                    "success_probability": simulation.success_probability,
                    "target_amount": float(goal.target_amount),
                }
            )

        score = calculate_health_score(metrics)
        risk_level = derive_risk_level(metrics)
        recommendations = make_recommendations(metrics)
        alerts = detect_risk_alerts(metrics, goal_snapshots)

        agent_context = AgentContext(
            user_id=str(user.id),
            intent="full financial analysis",
            transactions=[
                {
                    "amount": float(txn.amount),
                    "merchant": txn.merchant,
                    "category": txn.category.value,
                    "txn_type": txn.txn_type.value,
                    "date": txn.date.isoformat(),
                }
                for txn in transactions
            ],
            metrics=metrics.to_dict(),
            goals=goal_snapshots,
            profile={
                "monthly_income": float(user.monthly_income) if user.monthly_income is not None else None,
                "tax_regime": user.tax_regime,
                "currency": user.currency,
            },
        )
        orchestrated = await self.orchestrator.run(agent_context, intent="full financial analysis")

        analysis = AnalysisResult(
            user_id=user.id,
            financial_score=score,
            risk_level=risk_level,
            metrics=metrics.to_dict(),
            recommendations=recommendations + orchestrated["recommendations"],
            agent_traces={"agents": orchestrated["agents"], "summary": orchestrated["summary"]},
        )
        session.add(analysis)

        existing_alert_keys = {
            (a.alert_type, a.title)
            for a in (
                await session.execute(
                    select(RiskAlert).where(
                        RiskAlert.user_id == user.id,
                        RiskAlert.is_resolved == False,  # noqa: E712
                    )
                )
            ).scalars().all()
        }
        for alert in alerts:
            key = (alert["alert_type"], alert["title"])
            if key in existing_alert_keys:
                continue
            session.add(
                RiskAlert(
                    user_id=user.id,
                    alert_type=alert["alert_type"],
                    severity=alert["severity"],
                    title=alert["title"],
                    message=alert["message"],
                    data=alert.get("data"),
                )
            )

        await session.flush()
        await session.refresh(analysis)
        return analysis

    async def get_health_score(self, *, session: AsyncSession, user: User) -> dict:
        analysis = await self.run_analysis(session=session, user=user)
        from_metrics = compute_financial_metrics(
            (
                await session.execute(select(Transaction).where(Transaction.user_id == user.id))
            ).scalars().all()
        )
        return {
            "score": analysis.financial_score,
            "breakdown": build_health_breakdown(from_metrics),
            "trend": await self._score_trend(session, user, fallback_score=analysis.financial_score),
            "comparison": await self._comparison_stats(session, user.id, analysis.financial_score),
        }

    async def get_risks(self, *, session: AsyncSession, user: User) -> dict:
        analysis = await self.run_analysis(session=session, user=user)
        alerts = (
            await session.execute(
                select(RiskAlert)
                .where(RiskAlert.user_id == user.id)
                .order_by(RiskAlert.created_at.desc())
                .limit(10)
            )
        ).scalars().all()
        return {
            "alerts": [
                {
                    "alert_id": str(alert.alert_id),
                    "alert_type": alert.alert_type.value,
                    "severity": alert.severity.value,
                    "title": alert.title,
                    "message": alert.message,
                    "data": alert.data or {},
                }
                for alert in alerts
            ],
            "overall_risk": analysis.risk_level.value,
        }

    async def _score_trend(self, session: AsyncSession, user: User, *, fallback_score: int) -> list[int]:
        results = (
            await session.execute(
                select(AnalysisResult.financial_score)
                .where(AnalysisResult.user_id == user.id)
                .order_by(AnalysisResult.created_at.desc())
                .limit(4)
            )
        ).scalars().all()
        scores = list(reversed(results))
        if not scores:
            return [fallback_score]
        while len(scores) < 4:
            scores.insert(0, scores[0])
        return scores

    async def _comparison_stats(self, session: AsyncSession, user_id: UUID, current_score: int) -> dict[str, int | bool | str | None]:
        rows = (
            await session.execute(
                select(AnalysisResult.user_id, AnalysisResult.financial_score, AnalysisResult.created_at)
                .order_by(AnalysisResult.created_at.desc())
            )
        ).all()

        latest_scores: dict[UUID, int] = {}
        for peer_user_id, score, _created_at in rows:
            if peer_user_id == user_id or peer_user_id in latest_scores:
                continue
            latest_scores[peer_user_id] = int(score)

        scores = list(latest_scores.values())
        sample_size = len(scores)
        if sample_size < self.MIN_BENCHMARK_USERS:
            return {
                "available": False,
                "sample_size": sample_size,
                "percentile": None,
                "avg_score": None,
                "note": f"Need at least {self.MIN_BENCHMARK_USERS} peer analyses to publish a cohort benchmark.",
            }

        average = round(sum(scores) / sample_size)
        at_or_below = sum(1 for score in scores if score <= current_score)
        percentile = round((at_or_below / sample_size) * 100)
        return {
            "available": True,
            "sample_size": sample_size,
            "percentile": percentile,
            "avg_score": average,
            "note": None,
        }
