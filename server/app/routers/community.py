"""커뮤니티 쓰기 — 금칙어·권한·입력값 검사 후 저장. 앱은 posts·comments 에 직접 쓸 수 없다 (RLS)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field

from ..auth import CurrentUser, current_user, get_db, require_admin
from ..db import Supabase
from ..errors import ApiError
from ..safety import check

router = APIRouter()
Category = Literal["review", "meal", "exercise", "question", "free"]


class PostIn(BaseModel):
    category: Category
    title: str = Field(min_length=1, max_length=60)
    body: str = Field(min_length=1, max_length=3000)


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=500)


def _screen(db: Supabase, user_id: str, target: str, target_id: str | None, *parts: str):
    """검사하고 FILTER_LOGS 에 남긴다. BLOCKED 면 저장하지 않고 422."""
    level, matches = check(*parts)
    db.insert("filter_logs", {"user_id": user_id, "target_type": target, "target_id": target_id, "level": level, "matched_rule": ", ".join(sorted({m.rule for m in matches})) or None})
    if level == "BLOCKED":
        raise ApiError(
            422,
            "POST_BLOCKED",
            "의약품 판매·양도·나눔, 처방전 없는 구매 관련 글은 올릴 수 없어요.",
            "body",
            matches=[{"rule": m.rule, "text": m.text} for m in matches if m.level == "BLOCKED"],
        )
    return level


def _clean(s: str) -> str:
    return s.strip()


def _owned(db: Supabase, table: str, key: str, id_: str, user_id: str) -> dict:
    rows = db.select(table, select="*", **{key: f"eq.{id_}"}, deleted_at="is.null")
    if not rows:
        raise ApiError(404, "NOT_FOUND", "글을 찾을 수 없어요.")
    if rows[0]["user_id"] != user_id:
        raise ApiError(403, "NOT_OWNER", "내가 쓴 글만 고칠 수 있어요.")
    return rows[0]


@router.post("/posts", status_code=201)
def create_post(p: PostIn, user: CurrentUser = Depends(current_user), db: Supabase = Depends(get_db)):
    title, body = _clean(p.title), _clean(p.body)
    if not title or not body:
        raise ApiError(400, "EMPTY", "제목과 내용을 입력해 주세요.", "title" if not title else "body")
    level = _screen(db, user.id, "post", None, title, body)
    row = db.insert("posts", {"user_id": user.id, "category": p.category, "title": title, "body": body, "risk_level": level, "status": "hidden" if level == "REVIEW" else "visible"})[0]
    return {"post_id": row["post_id"], "risk_level": level, "status": row["status"]}


@router.patch("/posts/{post_id}")
def update_post(post_id: str, p: PostIn, user: CurrentUser = Depends(current_user), db: Supabase = Depends(get_db)):
    cur = _owned(db, "posts", "post_id", post_id, user.id)
    if cur["status"] == "blocked":
        raise ApiError(403, "BLOCKED_BY_ADMIN", "관리자가 막은 글은 고칠 수 없어요.")
    title, body = _clean(p.title), _clean(p.body)
    level = _screen(db, user.id, "post", post_id, title, body)  # 수정할 때도 다시 검사
    row = db.update("posts", {"category": p.category, "title": title, "body": body, "risk_level": level, "status": "hidden" if level == "REVIEW" else "visible"}, post_id=f"eq.{post_id}")[0]
    return {"post_id": post_id, "risk_level": level, "status": row["status"]}


@router.delete("/posts/{post_id}", status_code=204)
def delete_post(post_id: str, user: CurrentUser = Depends(current_user), db: Supabase = Depends(get_db)):
    _owned(db, "posts", "post_id", post_id, user.id)
    db.update("posts", {"deleted_at": datetime.now(timezone.utc).isoformat()}, post_id=f"eq.{post_id}")
    return Response(status_code=204)


@router.post("/posts/{post_id}/comments", status_code=201)
def create_comment(post_id: str, c: CommentIn, user: CurrentUser = Depends(current_user), db: Supabase = Depends(get_db)):
    post = db.select("posts", select="post_id,status,user_id", post_id=f"eq.{post_id}", deleted_at="is.null")
    if not post or (post[0]["status"] != "visible" and post[0]["user_id"] != user.id):
        raise ApiError(404, "NOT_FOUND", "글을 찾을 수 없어요.")
    body = _clean(c.body)
    level = _screen(db, user.id, "comment", None, body)
    row = db.insert("comments", {"post_id": post_id, "user_id": user.id, "body": body, "risk_level": level, "status": "hidden" if level == "REVIEW" else "visible"})[0]
    return {"comment_id": row["comment_id"], "risk_level": level, "status": row["status"]}


@router.patch("/comments/{comment_id}")
def update_comment(comment_id: str, c: CommentIn, user: CurrentUser = Depends(current_user), db: Supabase = Depends(get_db)):
    _owned(db, "comments", "comment_id", comment_id, user.id)
    body = _clean(c.body)
    level = _screen(db, user.id, "comment", comment_id, body)
    row = db.update("comments", {"body": body, "risk_level": level, "status": "hidden" if level == "REVIEW" else "visible"}, comment_id=f"eq.{comment_id}")[0]
    return {"comment_id": comment_id, "risk_level": level, "status": row["status"]}


@router.delete("/comments/{comment_id}", status_code=204)
def delete_comment(comment_id: str, user: CurrentUser = Depends(current_user), db: Supabase = Depends(get_db)):
    _owned(db, "comments", "comment_id", comment_id, user.id)
    db.update("comments", {"deleted_at": datetime.now(timezone.utc).isoformat()}, comment_id=f"eq.{comment_id}")
    return Response(status_code=204)


# ── 관리자 ──
class ActionIn(BaseModel):
    target_type: Literal["post", "comment", "report", "user"]
    target_id: str
    action: Literal["hide", "restore", "delete", "warn", "dismiss"]
    reason: str = Field(min_length=2, max_length=300)


@router.post("/admin/actions", status_code=201)
def admin_action(a: ActionIn, admin: CurrentUser = Depends(require_admin), db: Supabase = Depends(get_db)):
    """관리자 조치 — 사유 필수, 모든 조치는 ADMIN_ACTIONS 에 남긴다. 관리자 여부는 DB 에서 매번 확인."""
    now = datetime.now(timezone.utc).isoformat()
    table = {"post": ("posts", "post_id"), "comment": ("comments", "comment_id")}.get(a.target_type)
    if table:
        patch = {"hide": {"status": "blocked"}, "restore": {"status": "visible"}, "delete": {"deleted_at": now}}.get(a.action)
        if patch is None:
            raise ApiError(400, "BAD_ACTION", "글·댓글에는 숨기기·복구·삭제만 할 수 있어요.", "action")
        if not db.update(table[0], patch, **{table[1]: f"eq.{a.target_id}"}):
            raise ApiError(404, "NOT_FOUND", "대상을 찾을 수 없어요.", "target_id")
    elif a.target_type == "report":
        if a.action not in ("dismiss", "restore", "hide"):
            raise ApiError(400, "BAD_ACTION", "신고는 처리 완료 또는 기각만 할 수 있어요.", "action")
        status = "dismissed" if a.action == "dismiss" else "resolved"
        if not db.update("reports", {"status": status}, report_id=f"eq.{a.target_id}"):
            raise ApiError(404, "NOT_FOUND", "신고를 찾을 수 없어요.", "target_id")
    elif a.action != "warn":
        raise ApiError(400, "BAD_ACTION", "사용자에게는 경고만 기록할 수 있어요 (정지는 준비 중).", "action")
    row = db.insert("admin_actions", {"admin_id": admin.id, "target_type": a.target_type, "target_id": a.target_id, "action": a.action, "reason": a.reason.strip()})[0]
    return {"action_id": row["action_id"]}
