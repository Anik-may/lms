"""Categories and tags: public reads, platform-admin writes, and course tagging."""

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_course_management, require_permission
from app.models.courses import Course
from app.models.identity import User
from app.models.taxonomy import Category, CourseCategory, CourseTag, Tag

router = APIRouter(tags=["catalog"])


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    slug: str | None = Field(default=None, max_length=150)
    description: str | None = None
    parent_id: uuid.UUID | None = None
    display_order: int = 0


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    parent_id: uuid.UUID | None
    name: str
    slug: str
    description: str | None
    display_order: int


class TagIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class TagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str


class CourseTaxonomyIn(BaseModel):
    category_ids: list[uuid.UUID] = []
    tag_ids: list[uuid.UUID] = []


class CourseTaxonomyOut(BaseModel):
    categories: list[CategoryOut]
    tags: list[TagOut]


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "item"


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Category)
        .where(Category.status == "ACTIVE")
        .order_by(Category.display_order, Category.name)
    )
    return (await db.scalars(stmt)).all()


@router.post("/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryIn,
    _: User = Depends(require_permission("course.publish")),
    db: AsyncSession = Depends(get_db),
):
    cat = Category(**{**payload.model_dump(), "slug": payload.slug or _slug(payload.name)})
    db.add(cat)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug already in use")
    await db.refresh(cat)
    return cat


@router.patch("/categories/{category_id}", response_model=CategoryOut)
async def update_category(
    category_id: uuid.UUID,
    payload: CategoryIn,
    _: User = Depends(require_permission("course.publish")),
    db: AsyncSession = Depends(get_db),
):
    cat = await db.get(Category, category_id)
    if cat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(cat, k, v)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug already in use")
    await db.refresh(cat)
    return cat


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_category(
    category_id: uuid.UUID,
    _: User = Depends(require_permission("course.publish")),
    db: AsyncSession = Depends(get_db),
):
    cat = await db.get(Category, category_id)
    if cat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    cat.status = "ARCHIVED"
    await db.commit()


@router.get("/tags", response_model=list[TagOut])
async def list_tags(db: AsyncSession = Depends(get_db)):
    return (await db.scalars(select(Tag).order_by(Tag.name))).all()


@router.post("/tags", response_model=TagOut, status_code=status.HTTP_201_CREATED)
async def create_tag(
    payload: TagIn,
    _: User = Depends(require_permission("course.create")),
    db: AsyncSession = Depends(get_db),
):
    slug = _slug(payload.name)
    existing = await db.scalar(select(Tag).where(Tag.slug == slug))
    if existing is not None:
        return existing
    tag = Tag(name=payload.name, slug=slug)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return tag


async def _taxonomy(db: AsyncSession, course_id: uuid.UUID) -> CourseTaxonomyOut:
    cats = (
        await db.scalars(
            select(Category)
            .join(CourseCategory, CourseCategory.category_id == Category.id)
            .where(CourseCategory.course_id == course_id)
            .order_by(Category.name)
        )
    ).all()
    tags = (
        await db.scalars(
            select(Tag)
            .join(CourseTag, CourseTag.tag_id == Tag.id)
            .where(CourseTag.course_id == course_id)
            .order_by(Tag.name)
        )
    ).all()
    return CourseTaxonomyOut(categories=list(cats), tags=list(tags))


@router.get("/courses/{course_id}/taxonomy", response_model=CourseTaxonomyOut)
async def get_course_taxonomy(course_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    if await db.get(Course, course_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return await _taxonomy(db, course_id)


@router.put("/courses/{course_id}/taxonomy", response_model=CourseTaxonomyOut)
async def set_course_taxonomy(
    payload: CourseTaxonomyIn,
    course: Course = Depends(require_course_management("course.update")),
    db: AsyncSession = Depends(get_db),
):
    """Replaces the course's categories and tags; the first category is the primary one."""
    if payload.category_ids:
        found = set(
            (await db.scalars(select(Category.id).where(Category.id.in_(payload.category_ids)))).all()
        )
        if found != set(payload.category_ids):
            raise HTTPException(status_code=422, detail="Unknown category")
    if payload.tag_ids:
        found = set((await db.scalars(select(Tag.id).where(Tag.id.in_(payload.tag_ids)))).all())
        if found != set(payload.tag_ids):
            raise HTTPException(status_code=422, detail="Unknown tag")

    await db.execute(delete(CourseCategory).where(CourseCategory.course_id == course.id))
    await db.execute(delete(CourseTag).where(CourseTag.course_id == course.id))
    for i, cid in enumerate(dict.fromkeys(payload.category_ids)):
        db.add(CourseCategory(course_id=course.id, category_id=cid, is_primary=i == 0))
    for tid in dict.fromkeys(payload.tag_ids):
        db.add(CourseTag(course_id=course.id, tag_id=tid))
    await db.commit()
    return await _taxonomy(db, course.id)
