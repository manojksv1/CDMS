import logging
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import case
from sqlalchemy.orm import Session

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.models.implementation import (
    GlobalMilestone,
    Implementation,
    ImplementationLog,
    ImplementationTask,
    MilestoneSection,
)
from app.models.user import User, UserRole
from app.schemas.implementation import (
    GlobalMilestoneCreate,
    GlobalMilestoneUpdate,
    ImplementationCreate,
    ImplementationLogCreate,
    ImplementationUpdate,
    MilestoneSectionCreate,
    MilestoneSectionUpdate,
)

logger = logging.getLogger(__name__)

_STATUS_PRIORITY = case(
    (Implementation.status == "Live", 1),
    (Implementation.status == "Completed", 2),
    (Implementation.status == "Blocked", 3),
    (Implementation.status == "OnHold", 4),
    (Implementation.status == "InProgress", 5),
    else_=6,
)


# ---------------------------------------------------------------------------
# Implementation CRUD
# ---------------------------------------------------------------------------

def get_implementations(
    db: Session, current_user: User, skip: int = 0, limit: int = 100
) -> list[Implementation]:
    query = db.query(Implementation).order_by(
        _STATUS_PRIORITY,
        Implementation.current_percentage.desc(),
        Implementation.created_at.desc(),
    )
    if current_user.role == UserRole.ENGINEER:
        query = query.filter(Implementation.assigned_user_id == current_user.id)

    imps = query.offset(skip).limit(limit).all()
    for imp in imps:
        if imp.assigned_user:
            imp.assigned_user_name = imp.assigned_user.name
    return imps


def get_implementation(
    db: Session, implementation_id: int, current_user: User
) -> Implementation:
    query = db.query(Implementation).filter(Implementation.id == implementation_id)
    if current_user.role == UserRole.ENGINEER:
        query = query.filter(Implementation.assigned_user_id == current_user.id)

    imp = query.first()
    if not imp:
        raise NotFoundError(f"Implementation id={implementation_id} not found or access denied")

    if imp.assigned_user:
        imp.assigned_user_name = imp.assigned_user.name
    return imp


def create_implementation(db: Session, implementation: ImplementationCreate) -> Implementation:
    db_imp = Implementation(**implementation.model_dump())
    db.add(db_imp)
    db.commit()
    db.refresh(db_imp)

    sections = db.query(MilestoneSection).order_by(MilestoneSection.order).all()
    if not sections:
        seed_default_milestones(db)
        sections = db.query(MilestoneSection).order_by(MilestoneSection.order).all()

    for section in sections:
        for milestone in section.milestones:
            db.add(
                ImplementationTask(
                    implementation_id=db_imp.id,
                    task_name=milestone.task_name,
                    section_name=section.name,
                    weight=milestone.weight,
                )
            )

    db.commit()
    db.refresh(db_imp)
    _recalculate_percentage(db, db_imp.id)
    logger.info("Created implementation id=%s company=%s", db_imp.id, db_imp.company_name)
    return db_imp


def update_implementation(
    db: Session, implementation_id: int, implementation_update: ImplementationUpdate
) -> Implementation:
    db_imp = db.query(Implementation).filter(Implementation.id == implementation_id).first()
    if not db_imp:
        raise NotFoundError(f"Implementation id={implementation_id} not found")

    for key, value in implementation_update.model_dump(exclude_unset=True).items():
        setattr(db_imp, key, value)

    db.commit()
    db.refresh(db_imp)
    _recalculate_percentage(db, implementation_id)
    return db_imp


# ---------------------------------------------------------------------------
# Task operations
# ---------------------------------------------------------------------------

def update_task_status(db: Session, task_id: int, is_completed: bool) -> ImplementationTask:
    db_task = db.query(ImplementationTask).filter(ImplementationTask.id == task_id).first()
    if not db_task:
        raise NotFoundError(f"ImplementationTask id={task_id} not found")

    db_task.is_completed = is_completed
    db_task.completed_at = datetime.now(timezone.utc) if is_completed else None
    db.commit()
    _recalculate_percentage(db, db_task.implementation_id)
    return db_task


def bulk_update_tasks(db: Session, updates: list[dict]) -> bool:
    """
    updates: list of {"id": int, "is_completed": bool}
    Validated by the BulkTaskUpdate Pydantic schema before reaching here.
    """
    if not updates:
        return True

    implementation_id: int | None = None
    for item in updates:
        db_task = (
            db.query(ImplementationTask)
            .filter(ImplementationTask.id == item["id"])
            .first()
        )
        if db_task:
            db_task.is_completed = item["is_completed"]
            db_task.completed_at = (
                datetime.now(timezone.utc) if item["is_completed"] else None
            )
            implementation_id = db_task.implementation_id

    db.commit()
    if implementation_id:
        _recalculate_percentage(db, implementation_id)
    return True


def _recalculate_percentage(db: Session, implementation_id: int) -> None:
    tasks = (
        db.query(ImplementationTask)
        .filter(ImplementationTask.implementation_id == implementation_id)
        .all()
    )
    total = round(sum(t.weight for t in tasks if t.is_completed), 2)

    db_imp = db.query(Implementation).filter(Implementation.id == implementation_id).first()
    if not db_imp:
        return

    db_imp.current_percentage = total

    if total >= 100.0:
        if db_imp.status != "Live":
            db_imp.status = "Completed"
    elif db_imp.status == "Completed":
        # Revert only if manually completed (not Live)
        db_imp.status = "InProgress"

    db.commit()


# ---------------------------------------------------------------------------
# Log operations
# ---------------------------------------------------------------------------

def create_implementation_log(
    db: Session,
    implementation_id: int,
    user_id: int,
    log: ImplementationLogCreate,
) -> ImplementationLog:
    db_imp = db.query(Implementation).filter(Implementation.id == implementation_id).first()
    if not db_imp:
        raise NotFoundError(f"Implementation id={implementation_id} not found")

    tasks = (
        db.query(ImplementationTask)
        .filter(ImplementationTask.implementation_id == implementation_id)
        .order_by(ImplementationTask.id)
        .all()
    )

    current_stage = "Not Started"
    if tasks:
        current_stage = "Completed"
        for task in tasks:
            if not task.is_completed:
                current_stage = task.section_name or "In Progress"
                break

    db_log = ImplementationLog(
        implementation_id=implementation_id,
        user_id=user_id,
        date=log.date,
        remarks=log.remarks,
        percentage_at_time=db_imp.current_percentage,
        milestone_stage=current_stage,
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log


# ---------------------------------------------------------------------------
# Milestone template operations
# ---------------------------------------------------------------------------

def get_milestone_sections(db: Session) -> list[MilestoneSection]:
    return db.query(MilestoneSection).order_by(MilestoneSection.order).all()


def create_milestone_section(db: Session, section: MilestoneSectionCreate) -> MilestoneSection:
    db_s = MilestoneSection(**section.model_dump())
    db.add(db_s)
    db.commit()
    db.refresh(db_s)
    return db_s


def update_milestone_section(
    db: Session, section_id: int, update: MilestoneSectionUpdate
) -> MilestoneSection:
    db_s = db.query(MilestoneSection).filter(MilestoneSection.id == section_id).first()
    if not db_s:
        raise NotFoundError(f"MilestoneSection id={section_id} not found")

    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(db_s, key, value)
    db.commit()
    db.refresh(db_s)
    return db_s


def delete_milestone_section(db: Session, section_id: int) -> MilestoneSection:
    db_s = db.query(MilestoneSection).filter(MilestoneSection.id == section_id).first()
    if not db_s:
        raise NotFoundError(f"MilestoneSection id={section_id} not found")

    db.delete(db_s)
    db.commit()
    return db_s


def get_global_milestones(db: Session) -> list[GlobalMilestone]:
    return db.query(GlobalMilestone).order_by(GlobalMilestone.order).all()


def create_global_milestone(db: Session, milestone: GlobalMilestoneCreate) -> GlobalMilestone:
    if milestone.section_id:
        section = (
            db.query(MilestoneSection)
            .filter(MilestoneSection.id == milestone.section_id)
            .first()
        )
        if not section:
            raise NotFoundError(f"MilestoneSection id={milestone.section_id} not found")

        current_weight = sum(m.weight for m in section.milestones)
        if current_weight + milestone.weight > section.weight:
            raise BusinessRuleError(
                f"Cannot add task. Total weight in section '{section.name}' "
                f"would exceed its limit of {section.weight}%."
            )

    db_m = GlobalMilestone(**milestone.model_dump())
    db.add(db_m)
    db.commit()
    db.refresh(db_m)
    return db_m


def update_global_milestone(
    db: Session, milestone_id: int, update: GlobalMilestoneUpdate
) -> GlobalMilestone:
    db_m = db.query(GlobalMilestone).filter(GlobalMilestone.id == milestone_id).first()
    if not db_m:
        raise NotFoundError(f"GlobalMilestone id={milestone_id} not found")

    update_data = update.model_dump(exclude_unset=True)

    if "weight" in update_data and db_m.section_id:
        section = (
            db.query(MilestoneSection)
            .filter(MilestoneSection.id == db_m.section_id)
            .first()
        )
        if section:
            other_weight = sum(m.weight for m in section.milestones if m.id != milestone_id)
            if other_weight + update_data["weight"] > section.weight:
                raise BusinessRuleError(
                    f"Update failed. Section '{section.name}' limit of "
                    f"{section.weight}% would be exceeded."
                )

    for key, value in update_data.items():
        setattr(db_m, key, value)
    db.commit()
    db.refresh(db_m)
    return db_m


def delete_global_milestone(db: Session, milestone_id: int) -> GlobalMilestone:
    db_m = db.query(GlobalMilestone).filter(GlobalMilestone.id == milestone_id).first()
    if not db_m:
        raise NotFoundError(f"GlobalMilestone id={milestone_id} not found")

    db.delete(db_m)
    db.commit()
    return db_m


def bulk_reorder_milestones(db: Session, milestone_ids: list[int]) -> bool:
    for index, m_id in enumerate(milestone_ids):
        db.query(GlobalMilestone).filter(GlobalMilestone.id == m_id).update({"order": index})
    db.commit()
    return True


def sync_implementation_milestones(
    db: Session, implementation_id: int
) -> tuple[int, int, int]:
    master_milestones = db.query(GlobalMilestone).all()
    master_dict = {m.task_name: m for m in master_milestones}

    current = (
        db.query(ImplementationTask)
        .filter(ImplementationTask.implementation_id == implementation_id)
        .all()
    )
    current_names = {t.task_name for t in current}

    added = updated = removed = 0

    for m in master_milestones:
        if m.task_name not in current_names:
            db.add(
                ImplementationTask(
                    implementation_id=implementation_id,
                    task_name=m.task_name,
                    section_name=m.section.name if m.section else "General",
                    weight=m.weight,
                    is_active=True,
                )
            )
            added += 1

    for t in current:
        if t.task_name in master_dict:
            m = master_dict[t.task_name]
            if not t.is_active:
                t.is_active = True
                updated += 1
            if t.weight != m.weight:
                t.weight = m.weight
                updated += 1
        else:
            if t.is_active:
                t.is_active = False
                t.weight = 0.0
                removed += 1

    db.commit()
    _recalculate_percentage(db, implementation_id)
    logger.info(
        "Synced milestones for implementation id=%s: +%s ~%s -%s",
        implementation_id, added, updated, removed,
    )
    return added, updated, removed


# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------

def seed_default_milestones(db: Session) -> None:
    """Seed the default milestone structure. Idempotent — checks before inserting."""
    existing = db.query(MilestoneSection).count()
    if existing > 0:
        logger.info("Milestone sections already exist, skipping seed")
        return

    structure = [
        ("Pre_Requisites for DMS Implementation", 20.0, [
            ("Initial Pre-requisites Check", 20.0),
        ]),
        ("Preparation of DMS implementation plan", 10.0, [
            ("Creation of Implementation Plan", 10.0),
        ]),
        ("Contentverse Installation and Configuration", 40.0, [
            ("MSI installation", 2.0),
            ("Creation of Room Structures", 5.0),
            ("Creation of Document Types", 3.0),
            ("Index Fields with required Masking", 2.0),
            ("Advanced search and FTS", 3.0),
            ("Security Rights", 2.0),
            ("SMTP Email Notifications", 5.0),
            ("Workflow", 8.0),
            ("AD/LDAP", 5.0),
            ("SSL Certification", 5.0),
        ]),
        ("Testing and test reports", 10.0, [
            ("Testing execution & test reports", 5.0),
            ("Result & SOP documentation", 5.0),
        ]),
        ("Training", 10.0, [
            ("Introduction to Contentverse", 1.0),
            ("Room Structure Training", 1.0),
            ("Permissions & branched users", 1.0),
            ("Uploading & Annotations", 1.0),
            ("Version control & Comments", 1.0),
            ("Checkout/Checkin Mini ViewWise", 1.0),
            ("Export through Email", 1.0),
            ("Advance & Full Text Search", 1.0),
            ("Input Tray & Retention", 1.0),
            ("Workflow Training", 1.0),
        ]),
        ("Administator Training", 10.0, [
            ("Admin Dashboard & Storage", 2.0),
            ("Audit Trail & Users/Groups", 2.0),
            ("Template & Backup/Restore", 2.0),
            ("Redactions & Document Locking", 2.0),
            ("Admin Workflow & Reports", 2.0),
        ]),
        ("Customer sign off Document", 10.0, [
            ("Final Customer sign off Document", 10.0),
        ]),
    ]

    for idx, (sec_name, sec_weight, tasks) in enumerate(structure):
        db_sec = MilestoneSection(name=sec_name, weight=sec_weight, order=idx)
        db.add(db_sec)
        db.commit()
        db.refresh(db_sec)

        for t_idx, (t_name, t_weight) in enumerate(tasks):
            db.add(
                GlobalMilestone(
                    task_name=t_name,
                    section_id=db_sec.id,
                    weight=t_weight,
                    order=t_idx,
                )
            )
        db.commit()

    logger.info("Default milestone structure seeded successfully")
