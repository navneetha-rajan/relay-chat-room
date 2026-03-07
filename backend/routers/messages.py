import json

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import decode_token, get_current_user
from database import SessionLocal, get_db
from models import Message, Room, RoomMember, User
from schemas import MessageOut, WSMessage
from websocket_manager import app_manager, manager

router = APIRouter(tags=["messages"])


@router.get("/api/rooms/{room_id}/messages")
def get_messages(
    room_id: int,
    limit: int = Query(50, ge=1, le=200),
    before_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")

    membership = db.get(RoomMember, (current_user.id, room_id))
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this room")

    stmt = (
        select(Message, User.username)
        .join(User, Message.user_id == User.id)
        .where(Message.room_id == room_id)
    )
    if before_id:
        stmt = stmt.where(Message.id < before_id)

    rows = db.execute(stmt.order_by(Message.created_at.desc()).limit(limit)).all()

    messages = [
        MessageOut(
            id=msg.id,
            content=msg.content,
            user_id=msg.user_id,
            username=username,
            room_id=msg.room_id,
            created_at=msg.created_at,
        )
        for msg, username in reversed(rows)
    ]

    return {
        "messages": messages,
        "last_read_message_id": membership.last_read_message_id,
    }


@router.post("/api/rooms/{room_id}/read")
def mark_room_read(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    membership = db.get(RoomMember, (current_user.id, room_id))
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member")

    latest = db.scalar(
        select(Message.id)
        .where(Message.room_id == room_id)
        .order_by(Message.id.desc())
        .limit(1)
    )
    if latest is not None:
        membership.last_read_message_id = latest
        db.commit()

    return {"last_read_message_id": membership.last_read_message_id}


@router.websocket("/ws/app")
async def app_websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    """Global WebSocket for app-level events (room created/joined/left)."""
    payload = decode_token(token)
    user_id = int(payload["sub"])

    await app_manager.connect(user_id, websocket)

    try:
        while True:
            await websocket.receive_text()
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        app_manager.disconnect(user_id)


@router.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: int, token: str = Query(...)):
    payload = decode_token(token)
    user_id = int(payload["sub"])
    username = payload["username"]

    db = SessionLocal()
    try:
        room = db.get(Room, room_id)
        if not room:
            await websocket.close(code=4004, reason="Room not found")
            return

        membership = db.get(RoomMember, (user_id, room_id))
        if not membership:
            await websocket.close(code=4003, reason="Not a member of this room")
            return
    finally:
        db.close()

    await manager.connect(room_id, user_id, websocket)

    active_users = manager.get_active_users(room_id)

    await manager.send_personal(room_id, user_id, {
        "type": "active_users",
        "active_users": active_users,
    })

    await manager.broadcast_except(room_id, user_id, {
        "type": "user_joined",
        "user_id": user_id,
        "username": username,
        "active_users": active_users,
    })

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)

            if data.get("type") == "typing":
                await manager.broadcast_except(room_id, user_id, {
                    "type": "typing",
                    "user_id": user_id,
                    "username": username,
                })
                continue

            msg = WSMessage.model_validate(data)

            db = SessionLocal()
            try:
                message = Message(content=msg.content, user_id=user_id, room_id=room_id)
                db.add(message)
                db.commit()
                db.refresh(message)
                msg_id = message.id
                created_at = message.created_at
            finally:
                db.close()

            await manager.broadcast(room_id, {
                "type": "new_message",
                "id": msg_id,
                "content": msg.content,
                "user_id": user_id,
                "username": username,
                "room_id": room_id,
                "created_at": str(created_at),
            })

            await app_manager.broadcast_all({
                "type": "new_room_message",
                "room_id": room_id,
                "sender_id": user_id,
            })
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        manager.disconnect(room_id, user_id)
        try:
            await manager.broadcast(room_id, {
                "type": "user_left",
                "user_id": user_id,
                "username": username,
                "active_users": manager.get_active_users(room_id),
            })
        except Exception:
            pass
