import json
from datetime import datetime, timedelta, date
from sqlalchemy.orm import Session
from app.models.implementation import Implementation, ImplementationLog, ImplementationTask
from app.models.task import Task, TaskStatus
from app.models.client import Client
from app.models.location import Location
from app.models.user import User
from app.core.config import settings

def generate_weekly_executive_summary(db: Session, current_user: User, summary_type: str = 'implementation') -> str:
    if not settings.GEMINI_API_KEY:
        return "AI Summary is unavailable because GEMINI_API_KEY is not configured."

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        return "AI SDK not installed. Please add google-genai to requirements and rebuild."

    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    context_str = ""
    prompt = ""

    if summary_type == 'implementation':
        # Get all active or recently updated implementations
        recent_logs = db.query(ImplementationLog).filter(
            ImplementationLog.created_at >= seven_days_ago
        ).all()

        active_imp_ids = {log.implementation_id for log in recent_logs}
        active_imps = db.query(Implementation).filter(Implementation.id.in_(active_imp_ids)).all()

        if not active_imps:
            return "No significant activity recorded in the past 7 days for Software Implementations to generate a summary."

        data_context = []
        for imp in active_imps:
            imp_logs = [log for log in recent_logs if log.implementation_id == imp.id]
            
            # Fetch Milestones (Tasks) to give AI current state context
            all_tasks = db.query(ImplementationTask).filter(ImplementationTask.implementation_id == imp.id).all()
            completed_tasks = [t.task_name for t in all_tasks if t.is_completed]
            pending_tasks = [t.task_name for t in all_tasks if not t.is_completed]
            
            log_texts = [f"- {log.created_at.strftime('%Y-%m-%d')}: {(log.user.name if log.user else 'System')} logged '{log.remarks}'" for log in imp_logs]
            
            project_data = (
                f"Project: {imp.company_name} (Status: {imp.status}, Current Progress: {imp.current_percentage}%)\n"
                f"Engineer: {(imp.assigned_user.name if imp.assigned_user else 'Unassigned')}\n"
                f"CURRENT STATE (Milestones Completed): {', '.join(completed_tasks) if completed_tasks else 'None'}\n"
                f"PENDING MILESTONES: {', '.join(pending_tasks) if pending_tasks else 'None'}\n"
                f"Recent Log Updates (Past 7 Days):\n" + "\n".join(log_texts)
            )
            data_context.append(project_data)

        context_str = "\n\n".join(data_context)
        prompt = f"""
        You are an expert Executive Project Management Assistant for a Software Implementation department.
        Your task is to generate a clean, concise, and professional "Weekly Executive Summary" based on the following project activity data from the last 7 days.
        
        CRITICAL INSTRUCTION: Pay close attention to the "CURRENT STATE (Milestones Completed)" and "PENDING MILESTONES" fields. A log might say "planning phase" from days ago, but the Milestones will tell you exactly what phase the project is ACTUALLY in right now. Do not get confused by old logs if milestones indicate further progress.

        Focus on:
        1. Overall Highlights (What went live, major progress jumps based on milestones and logs).
        2. Risks and Bottlenecks (Projects that seem stuck or have logs indicating client/technical delays).
        3. Action Items for Management.

        Data Context:
        {context_str}

        Output the summary in clean Markdown format. Do not invent data. If the data is sparse, be brief. Ensure consistent analysis based on current milestones.
        """
        
    elif summary_type == 'installation':
        # Hardware / Installation Tracker
        tasks = db.query(Task).all()
        
        recent_completed = [t for t in tasks if t.status == TaskStatus.COMPLETED] # Ideally filter by completed_at, but we only have due_date
        delayed_tasks = [t for t in tasks if t.due_date < date.today() and t.status != TaskStatus.COMPLETED]
        in_progress = [t for t in tasks if t.status == TaskStatus.IN_PROGRESS]
        
        if not tasks:
            return "No Installation tasks found to summarize."
            
        data_context = []
        data_context.append(f"Total Delayed Tasks (Hardware/Installation): {len(delayed_tasks)}")
        data_context.append(f"Tasks In Progress: {len(in_progress)}")
        
        if delayed_tasks:
            data_context.append("Key Delayed Tasks:")
            for t in delayed_tasks[:10]: # Top 10 delayed
                client_name = t.location.client.name if t.location and t.location.client else "Unknown Client"
                assignee = t.assignee.name if t.assignee else "Unassigned"
                data_context.append(f"- Task: {t.name} (Client: {client_name}, Due: {t.due_date}, Assigned: {assignee}, Remarks: {t.remarks or 'None'})")

        context_str = "\n".join(data_context)
        prompt = f"""
        You are an expert Executive Project Management Assistant for a Hardware Installation department.
        Your task is to generate a clean, concise, and professional "Weekly Executive Summary" based on the following hardware installation data.

        Focus on:
        1. Overall Health (Count of delayed vs in progress tasks).
        2. Key Risks and Bottlenecks (Focus heavily on the delayed tasks and their remarks/blockers).
        3. Action Items for Management (e.g., follow up with specific unassigned tasks or specific engineers with multiple delays).

        Data Context:
        {context_str}

        Output the summary in clean Markdown format. Do not invent data.
        """

    else:
        return "Invalid summary type requested."

    # 2. Call Gemini
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    
    try:
        response = client.models.generate_content(
            model='gemini-3.1-flash-lite-preview',
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2, # Lower temperature for consistency and less hallucination
            )
        )
        return response.text
    except Exception as e:
        return f"Failed to generate AI summary. Error: {str(e)}"
