import json

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import decode_token, get_current_user
from database import SessionLocal, get_db
from models import Message, Room, RoomMember, User
from schemas import MessageOut, WSMessage
from websocket_manager import manager

router = APIRouter(tags=["messages"])


@router.get("/api/rooms/{room_id}/messages", response_model=list[MessageOut])
def get_messages(
    room_id: int,
    limit: int = Query(50, ge=1, le=200),
    before_id: int | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")

    stmt = (
        select(Message, User.username)
        .join(User, Message.user_id == User.id)
        .where(Message.room_id == room_id)
    )
    if before_id:
        stmt = stmt.where(Message.id < before_id)

    rows = db.execute(stmt.order_by(Message.created_at.desc()).limit(limit)).all()

    return [
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
            db.add(RoomMember(user_id=user_id, room_id=room_id))
            db.commit()
    finally:
        db.close()

    await manager.connect(room_id, user_id, websocket)

    await manager.broadcast(room_id, {
        "type": "user_joined",
        "user_id": user_id,
        "username": username,
        "active_users": manager.get_active_users(room_id),
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
    except WebSocketDisconnect:
        manager.disconnect(room_id, user_id)
        await manager.broadcast(room_id, {
            "type": "user_left",
            "user_id": user_id,
            "username": username,
            "active_users": manager.get_active_users(room_id),
        })
    except Exception:
        manager.disconnect(room_id, user_id)
        await manager.broadcast(room_id, {
            "type": "user_left",
            "user_id": user_id,
            "username": username,
            "active_users": manager.get_active_users(room_id),
        })
