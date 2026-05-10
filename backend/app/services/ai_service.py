import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.implementation import Implementation, ImplementationLog, ImplementationTask
from app.models.location import Location
from app.models.task import Task, TaskStatus
from app.models.user import User

logger = logging.getLogger(__name__)


def _get_genai_client():
    """Lazy import and initialise the Gemini client."""
    try:
        from google import genai
        from google.genai import types
        return genai.Client(api_key=settings.GEMINI_API_KEY), types
    except ImportError:
        return None, None


def generate_weekly_executive_summary(
    db: Session, current_user: User, summary_type: str = "implementation"
) -> str:
    if not settings.GEMINI_API_KEY:
        return "AI Summary is unavailable: GEMINI_API_KEY is not configured."

    client, types = _get_genai_client()
    if client is None:
        return "AI SDK not installed. Add google-genai to requirements and rebuild."

    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    if summary_type == "implementation":
        recent_logs = (
            db.query(ImplementationLog)
            .filter(ImplementationLog.created_at >= seven_days_ago)
            .all()
        )
        active_imp_ids = {log.implementation_id for log in recent_logs}
        active_imps = (
            db.query(Implementation).filter(Implementation.id.in_(active_imp_ids)).all()
        )

        if not active_imps:
            return "No significant activity in the past 7 days for Software Implementations."

        data_context = []
        for imp in active_imps:
            imp_logs = [l for l in recent_logs if l.implementation_id == imp.id]
            all_tasks = (
                db.query(ImplementationTask)
                .filter(ImplementationTask.implementation_id == imp.id)
                .all()
            )
            completed = [t.task_name for t in all_tasks if t.is_completed and t.is_active]
            pending = [t.task_name for t in all_tasks if not t.is_completed and t.is_active]
            removed = [t.task_name for t in all_tasks if not t.is_active]
            log_lines = [
                f"- {l.created_at.strftime('%Y-%m-%d')}: "
                f"{l.user.name if l.user else 'System'} logged '{l.remarks}'"
                for l in imp_logs
            ]
            data_context.append(
                f"Project: {imp.company_name} (Status: {imp.status}, "
                f"Progress: {imp.current_percentage}%)\n"
                f"Engineer: {imp.assigned_user.name if imp.assigned_user else 'Unassigned'}\n"
                f"Completed Milestones: {', '.join(completed) or 'None'}\n"
                f"Pending Milestones: {', '.join(pending) or 'None'}\n"
                f"Removed Milestones: {', '.join(removed) or 'None'}\n"
                f"Recent Logs:\n" + "\n".join(log_lines)
            )

        prompt = (
            "You are an expert Executive Project Management Assistant.\n"
            "Generate a concise 'Weekly Executive Summary' from the data below.\n\n"
            "Focus on:\n"
            "1. Overall Highlights\n"
            "2. Risks and Bottlenecks\n"
            "3. Action Items for Management\n\n"
            f"Data:\n{chr(10).join(data_context)}\n\n"
            "Output in clean Markdown. Do not invent data."
        )

    elif summary_type == "installation":
        tasks = db.query(Task).all()
        if not tasks:
            return "No Installation tasks found to summarise."

        delayed = [t for t in tasks if t.due_date < date.today() and t.status != TaskStatus.COMPLETED]
        in_progress = [t for t in tasks if t.status == TaskStatus.IN_PROGRESS]

        lines = [
            f"Total Delayed Tasks: {len(delayed)}",
            f"Tasks In Progress: {len(in_progress)}",
        ]
        for t in delayed[:10]:
            client_name = (
                t.location.client.name if t.location and t.location.client else "Unknown"
            )
            assignee = t.assignee.name if t.assignee else "Unassigned"
            lines.append(
                f"- {t.name} (Client: {client_name}, Due: {t.due_date}, "
                f"Assigned: {assignee}, Remarks: {t.remarks or 'None'})"
            )

        prompt = (
            "You are an expert Executive Project Management Assistant.\n"
            "Generate a concise 'Weekly Executive Summary' for the installation tracker.\n\n"
            "Focus on:\n"
            "1. Overall Health\n"
            "2. Key Risks and Bottlenecks\n"
            "3. Action Items for Management\n\n"
            f"Data:\n{chr(10).join(lines)}\n\n"
            "Output in clean Markdown. Do not invent data."
        )
    else:
        return "Invalid summary type requested."

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.2),
        )
        return response.text
    except Exception as exc:
        logger.exception("Gemini API call failed")
        return f"Failed to generate AI summary: {exc}"


def handle_chat_query(
    db: Session,
    current_user: User,
    query: str,
    summary_type: str,
    client_id: int | None = None,
    history: list | None = None,
) -> str:
    if not settings.GEMINI_API_KEY:
        return "AI Chat is unavailable: GEMINI_API_KEY is not configured."

    client, types = _get_genai_client()
    if client is None:
        return "AI SDK not installed."

    if summary_type == "implementation":
        imp_query = db.query(Implementation)
        if client_id:
            imp_query = imp_query.filter(Implementation.id == client_id)
        imps = imp_query.all()

        if not imps:
            return "No active software implementation projects found for the selected criteria."

        data_parts = []
        for imp in imps:
            all_tasks = (
                db.query(ImplementationTask)
                .filter(ImplementationTask.implementation_id == imp.id)
                .all()
            )
            completed = [t.task_name for t in all_tasks if t.is_completed and t.is_active]
            pending = [t.task_name for t in all_tasks if not t.is_completed and t.is_active]
            recent_logs = (
                db.query(ImplementationLog)
                .filter(ImplementationLog.implementation_id == imp.id)
                .order_by(ImplementationLog.created_at.desc())
                .limit(10)
                .all()
            )
            log_lines = [
                f"- {l.created_at.strftime('%Y-%m-%d')}: "
                f"{l.user.name if l.user else 'System'} logged '{l.remarks}'"
                for l in recent_logs
            ]
            data_parts.append(
                f"Project: {imp.company_name} (Status: {imp.status}, "
                f"Progress: {imp.current_percentage}%)\n"
                f"Engineer: {imp.assigned_user.name if imp.assigned_user else 'Unassigned'}\n"
                f"Completed: {', '.join(completed) or 'None'}\n"
                f"Pending: {', '.join(pending) or 'None'}\n"
                f"Last 10 Logs:\n" + "\n".join(log_lines)
            )
        context_str = "\n\n".join(data_parts)

    elif summary_type == "installation":
        task_query = db.query(Task)
        if client_id:
            task_query = task_query.join(Location).filter(Location.client_id == client_id)
        tasks = task_query.all()

        if not tasks:
            return "No installation tasks found for the selected criteria."

        lines = []
        seen_clients: set[int] = set()
        for t in tasks:
            c = t.location.client if t.location else None
            if c and c.id not in seen_clients:
                seen_clients.add(c.id)
                lines.append(f"\n[CLIENT: {c.name}]")
            assignee = t.assignee.name if t.assignee else "Unassigned"
            lines.append(
                f"- {t.name} (Status: {t.status.value}, Due: {t.due_date}, "
                f"Assigned: {assignee}, Remarks: {t.remarks or 'None'})"
            )
        context_str = "\n".join(lines)
    else:
        return "Invalid tracker type."

    history_block = ""
    if history:
        history_block = "=== CONVERSATION HISTORY ===\n"
        for msg in history[-5:]:
            role = "User" if msg.role == "user" else "AI"
            history_block += f"{role}: {msg.content}\n"
        history_block += "============================\n\n"

    prompt = (
        "You are an expert Data Analyst and Project Manager Assistant.\n"
        "Answer the user's question based ONLY on the system data below.\n\n"
        f"=== SYSTEM DATA ===\n{context_str}\n===================\n\n"
        f"{history_block}"
        f"User's Question: {query}\n\n"
        "Answer clearly and concisely in Markdown. "
        "If the answer cannot be determined from the data, say so."
    )

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
        )
        return response.text
    except Exception as exc:
        logger.exception("Gemini chat API call failed")
        return f"Failed to get an answer from AI: {exc}"
