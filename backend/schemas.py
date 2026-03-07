from datetime import datetime

from pydantic import BaseModel, Field


# ── Auth ─────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6)


class UserOut(BaseModel):
    id: int
    username: str
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── Rooms ────────────────────────────────────────────────────────────────────

class RoomCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class RoomOut(BaseModel):
    id: int
    name: str
    created_by: int
    created_at: datetime
    is_member: bool = False
    unread_count: int = 0


class RoomMemberOut(BaseModel):
    user_id: int
    username: str
    joined_at: datetime


# ── Messages ─────────────────────────────────────────────────────────────────

class MessageOut(BaseModel):
    id: int
    content: str
    user_id: int
    username: str
    room_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class WSMessage(BaseModel):
    """Incoming WebSocket message payload."""
    content: str = Field(min_length=1, max_length=2000)
