import { useCallback, useEffect, useRef, useState } from "react";
import api, { WS_BASE } from "../api";
import { useAuth } from "../context/AuthContext";
import RoomList from "./RoomList";
import ChatRoom from "./ChatRoom";

export default function Chat() {
  const { user, token, logout } = useAuth();
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [rooms, setRooms] = useState([]);
  const appWsRef = useRef(null);
  const reconnectTimeout = useRef(null);
  const selectedRoomRef = useRef(null);

  // Fetch rooms on mount
  useEffect(() => {
    async function loadRooms() {
      try {
        const { data } = await api.get("/api/rooms");
        setRooms(data);
      } catch {
        /* silent */
      }
    }
    loadRooms();
  }, []);

  useEffect(() => { selectedRoomRef.current = selectedRoom; }, [selectedRoom]);

  // Global WebSocket for app-level events
  useEffect(() => {
    let intentionalClose = false;

    function connect() {
      const ws = new WebSocket(`${WS_BASE}/ws/app?token=${token}`);
      appWsRef.current = ws;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "room_created") {
          const newRoom = { ...data.room, is_member: data.room.created_by === user.id };
          setRooms((prev) => {
            if (prev.some((r) => r.id === newRoom.id)) return prev;
            return [...prev, newRoom];
          });
        } else if (data.type === "room_joined") {
          if (data.user_id === user.id) {
            setRooms((prev) =>
              prev.map((r) => (r.id === data.room_id ? { ...r, is_member: true } : r)),
            );
          }
        } else if (data.type === "room_left") {
          if (data.user_id === user.id) {
            setRooms((prev) =>
              prev.map((r) => (r.id === data.room_id ? { ...r, is_member: false } : r)),
            );
          }
        } else if (data.type === "new_room_message") {
          if (data.sender_id !== user.id && data.room_id !== selectedRoomRef.current?.id) {
            setRooms((prev) =>
              prev.map((r) =>
                r.id === data.room_id ? { ...r, unread_count: (r.unread_count || 0) + 1 } : r,
              ),
            );
          }
        }
      };

      ws.onclose = () => {
        if (!intentionalClose) {
          reconnectTimeout.current = setTimeout(connect, 2000);
        }
      };
    }

    connect();

    return () => {
      intentionalClose = true;
      clearTimeout(reconnectTimeout.current);
      appWsRef.current?.close();
    };
  }, [token, user.id]);

  const handleSelectRoom = useCallback((room) => {
    setSelectedRoom(room);
    setRooms((prev) =>
      prev.map((r) => (r.id === room.id ? { ...r, unread_count: 0 } : r)),
    );
  }, []);

  const handleLeaveRoom = useCallback(
    (leftRoomId) => {
      setRooms((prev) =>
        prev.map((r) => (r.id === leftRoomId ? { ...r, is_member: false } : r)),
      );
      if (selectedRoom?.id === leftRoomId) {
        setSelectedRoom(null);
      }
    },
    [selectedRoom],
  );

  const handleJoinRoom = useCallback((updatedRoom) => {
    setRooms((prev) =>
      prev.map((r) => (r.id === updatedRoom.id ? { ...updatedRoom, unread_count: 0 } : r)),
    );
    setSelectedRoom(updatedRoom);
  }, []);

  const handleRoomCreated = useCallback((newRoom) => {
    setRooms((prev) => {
      if (prev.some((r) => r.id === newRoom.id)) return prev;
      return [...prev, newRoom];
    });
    setSelectedRoom(newRoom);
  }, []);

  const currentRoom = selectedRoom
    ? rooms.find((r) => r.id === selectedRoom.id) || selectedRoom
    : null;

  return (
    <div className="flex h-screen flex-col bg-[#313338]">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-white/[0.06] bg-[#2b2d31] px-6 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h1 className="text-[15px] font-semibold text-white">ChatRoom</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-gray-400">
            <span className="text-gray-300">{user.username}</span>
          </span>
          <button
            onClick={logout}
            className="rounded-md px-3 py-1 text-[13px] font-medium text-gray-400 transition-all duration-150 hover:bg-white/[0.06] hover:text-white"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <RoomList
          rooms={rooms}
          selectedRoom={currentRoom}
          onSelectRoom={handleSelectRoom}
          onLeaveRoom={handleLeaveRoom}
          onJoinRoom={handleJoinRoom}
          onRoomCreated={handleRoomCreated}
        />
        {currentRoom ? (
          <ChatRoom room={currentRoom} onJoinRoom={handleJoinRoom} />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/[0.04]">
                <svg className="h-10 w-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-300">Select a room to start chatting</p>
              <p className="mt-1.5 text-sm text-gray-500">Or create a new room from the sidebar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
