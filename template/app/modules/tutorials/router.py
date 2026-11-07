"""Routeur du module tutorials (Chap 11).

Catalogue + détail + contenu de leçon, tous avec contrôle d'accès par rôle
(round visibilité, 2026-11-07) : un tutoriel non-anonyme n'apparaît même
plus dans le catalogue pour qui n'a pas le rôle requis — avant cette
modification, seule la LEÇON était protégée ; le titre du tutoriel restait
visible à tout le monde (juste annoté "Premium"). Le core inclut ce routeur
sous /api/content lorsque MODULE_TUTORIALS=true.

Sécurité : le filtrage frontend ne suffit pas — la visibilité ET le contenu
sont tranchés ici, jamais côté client (Chap 11).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth.dependencies import get_current_user_optional, role_rank
from app.core.database import get_db
from app.core.models import User, UserRole
from app.modules.tutorials.models import Lesson, Tutorial
from app.modules.tutorials.schemas import (
    LessonRead,
    TutorialDetail,
    TutorialSummary,
)

router = APIRouter()


def _can_view(tutorial: Tutorial, user: User | None) -> bool:
    if tutorial.access_role == UserRole.anonymous:
        return True
    return user is not None and role_rank(user.role) >= role_rank(tutorial.access_role)


@router.get("/tutorials", response_model=list[TutorialSummary])
async def list_tutorials(
    lang: str = "fr",
    user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> list[Tutorial]:
    result = await db.execute(
        select(Tutorial).where(Tutorial.lang == lang).order_by(Tutorial.id)
    )
    return [t for t in result.scalars().all() if _can_view(t, user)]


@router.get("/tutorials/{slug}", response_model=TutorialDetail)
async def get_tutorial(slug: str, db: AsyncSession = Depends(get_db)) -> Tutorial:
    tutorial = (
        await db.execute(
            select(Tutorial)
            .where(Tutorial.slug == slug)
            .options(selectinload(Tutorial.lessons))
        )
    ).scalar_one_or_none()
    if tutorial is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tutoriel introuvable"
        )
    return tutorial


@router.get("/tutorials/{slug}/lessons/{lesson_id}", response_model=LessonRead)
async def get_lesson(
    slug: str,
    lesson_id: int,
    user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> Lesson:
    tutorial = (
        await db.execute(select(Tutorial).where(Tutorial.slug == slug))
    ).scalar_one_or_none()
    if tutorial is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tutoriel introuvable"
        )

    # Contrôle d'accès : un tutoriel non-anonyme exige un rôle suffisant.
    if tutorial.access_role != UserRole.anonymous:
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentification requise",
            )
        if role_rank(user.role) < role_rank(tutorial.access_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Accès insuffisant"
            )

    lesson = (
        await db.execute(
            select(Lesson).where(
                Lesson.tutorial_id == tutorial.id, Lesson.id == lesson_id
            )
        )
    ).scalar_one_or_none()
    if lesson is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Leçon introuvable"
        )
    return lesson
