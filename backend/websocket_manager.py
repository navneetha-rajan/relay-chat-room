import json
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    """Manages WebSocket connections grouped by room."""

    def __init__(self) -> None:
        self._rooms: dict[int, dict[int, WebSocket]] = defaultdict(dict)

    async def connect(self, room_id: int, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self._rooms[room_id][user_id] = websocket

    def disconnect(self, room_id: int, user_id: int) -> None:
        self._rooms[room_id].pop(user_id, None)
        if not self._rooms[room_id]:
            del self._rooms[room_id]

    def get_active_users(self, room_id: int) -> list[int]:
        return list(self._rooms.get(room_id, {}).keys())

    async def broadcast(self, room_id: int, message: dict) -> None:
        payload = json.dumps(message, default=str)
        stale: list[int] = []
        for uid, ws in self._rooms.get(room_id, {}).items():
            try:
                await ws.send_text(payload)
            except Exception:
                stale.append(uid)
        for uid in stale:
            self.disconnect(room_id, uid)

    async def broadcast_except(self, room_id: int, exclude_user_id: int, message: dict) -> None:
        """Send to everyone in the room except the specified user."""
        payload = json.dumps(message, default=str)
        stale: list[int] = []
        for uid, ws in self._rooms.get(room_id, {}).items():
            if uid == exclude_user_id:
                continue
            try:
                await ws.send_text(payload)
            except Exception:
                stale.append(uid)
        for uid in stale:
            self.disconnect(room_id, uid)

    async def send_personal(self, room_id: int, user_id: int, message: dict) -> None:
        ws = self._rooms.get(room_id, {}).get(user_id)
        if ws:
            await ws.send_text(json.dumps(message, default=str))


manager = ConnectionManager()
