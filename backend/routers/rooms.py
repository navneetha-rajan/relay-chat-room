from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Message, Room, RoomMember, User
from schemas import RoomCreate, RoomMemberOut, RoomOut
from websocket_manager import app_manager

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


@router.get("", response_model=list[RoomOut])
def list_rooms(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rooms = db.scalars(select(Room).order_by(Room.created_at)).all()

    member_rows = db.execute(
        select(RoomMember.room_id, RoomMember.last_read_message_id)
        .where(RoomMember.user_id == current_user.id)
    ).all()

    user_room_ids: set[int] = set()
    last_read_map: dict[int, int | None] = {}
    for room_id, last_read_id in member_rows:
        user_room_ids.add(room_id)
        last_read_map[room_id] = last_read_id

    unread_counts: dict[int, int] = {}
    for room_id in user_room_ids:
        last_read_id = last_read_map[room_id]
        stmt = select(func.count(Message.id)).where(Message.room_id == room_id)
        if last_read_id is not None:
            stmt = stmt.where(Message.id > last_read_id)
        unread_counts[room_id] = db.scalar(stmt) or 0

    return [
        RoomOut(
            id=r.id,
            name=r.name,
            created_by=r.created_by,
            created_at=r.created_at,
            is_member=r.id in user_room_ids,
            unread_count=unread_counts.get(r.id, 0),
        )
        for r in rooms
    ]


@router.post("", response_model=RoomOut, status_code=status.HTTP_201_CREATED)
async def create_room(
    body: RoomCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.scalars(select(Room).where(Room.name == body.name)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Room name already exists")

    room = Room(name=body.name, created_by=current_user.id)
    db.add(room)
    db.flush()

    membership = RoomMember(user_id=current_user.id, room_id=room.id)
    db.add(membership)
    db.commit()
    db.refresh(room)

    await app_manager.broadcast_all({
        "type": "room_created",
        "room": {
            "id": room.id,
            "name": room.name,
            "created_by": room.created_by,
            "created_at": str(room.created_at),
        },
    })

    return RoomOut(
        id=room.id,
        name=room.name,
        created_by=room.created_by,
        created_at=room.created_at,
        is_member=True,
    )


@router.post("/{room_id}/join", response_model=RoomOut)
async def join_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")

    already = db.get(RoomMember, (current_user.id, room_id))
    if not already:
        latest_msg_id = db.scalar(
            select(Message.id).where(Message.room_id == room_id).order_by(Message.id.desc()).limit(1)
        )
        db.add(RoomMember(user_id=current_user.id, room_id=room_id, last_read_message_id=latest_msg_id))
        db.commit()

        member_count = db.scalar(
            select(func.count()).where(RoomMember.room_id == room_id)
        )

        await app_manager.broadcast_all({
            "type": "room_joined",
            "room_id": room_id,
            "user_id": current_user.id,
            "username": current_user.username,
            "member_count": member_count,
        })

    return RoomOut(
        id=room.id,
        name=room.name,
        created_by=room.created_by,
        created_at=room.created_at,
        is_member=True,
        unread_count=0,
    )


@router.post("/{room_id}/leave", status_code=status.HTTP_200_OK)
async def leave_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")

    membership = db.get(RoomMember, (current_user.id, room_id))
    if not membership:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not a member")

    db.delete(membership)
    db.commit()

    member_count = db.scalar(
        select(func.count()).where(RoomMember.room_id == room_id)
    )

    await app_manager.broadcast_all({
        "type": "room_left",
        "room_id": room_id,
        "user_id": current_user.id,
        "username": current_user.username,
        "member_count": member_count,
    })

    return {"detail": "Left room"}


@router.get("/{room_id}/members", response_model=list[RoomMemberOut])
def room_members(
    room_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")

    rows = db.execute(
        select(RoomMember, User.username)
        .join(User, RoomMember.user_id == User.id)
        .where(RoomMember.room_id == room_id)
        .order_by(RoomMember.joined_at)
    ).all()

    return [
        RoomMemberOut(user_id=rm.user_id, username=username, joined_at=rm.joined_at)
        for rm, username in rows
    ]
