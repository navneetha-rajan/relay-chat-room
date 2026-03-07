from datetime import datetime, timezone

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))

    messages: Mapped[list["Message"]] = relationship(back_populates="user")
    memberships: Mapped[list["RoomMember"]] = relationship(back_populates="user")
    created_rooms: Mapped[list["Room"]] = relationship(back_populates="creator")


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))

    creator: Mapped["User"] = relationship(back_populates="created_rooms")
    messages: Mapped[list["Message"]] = relationship(back_populates="room", cascade="all, delete-orphan")
    members: Mapped[list["RoomMember"]] = relationship(back_populates="room", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))

    user: Mapped["User"] = relationship(back_populates="messages")
    room: Mapped["Room"] = relationship(back_populates="messages")


class RoomMember(Base):
    __tablename__ = "room_members"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), primary_key=True)
    joined_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
    last_read_message_id: Mapped[int | None] = mapped_column(default=None)

    user: Mapped["User"] = relationship(back_populates="memberships")
    room: Mapped["Room"] = relationship(back_populates="members")
