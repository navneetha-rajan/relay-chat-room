import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api, { WS_BASE } from "../api";
import { useAuth } from "../context/AuthContext";
import RoomList from "./RoomList";
import ChatRoom from "./ChatRoom";

const RelayIcon = ({ className = "h-5 w-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export default function Chat() {
  const { user, token, logout } = useAuth();
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [rooms, setRooms] = useState([]);
  const appWsRef = useRef(null);
  const reconnectTimeout = useRef(null);
  const selectedRoomRef = useRef(null);

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

  const stats = useMemo(() => ({
    totalRooms: rooms.length,
    joinedRooms: rooms.filter((r) => r.is_member).length,
  }), [rooms]);

  return (
    <div className="flex h-screen flex-col bg-[#313338]">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-white/[0.06] bg-[#2b2d31] px-6 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600">
            <RelayIcon className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-[15px] font-semibold text-white">Relay</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-gray-300">{user.username}</span>
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
          <div key={currentRoom.id} className="room-enter flex flex-1 overflow-hidden">
            <ChatRoom room={currentRoom} onJoinRoom={handleJoinRoom} />
          </div>
        ) : (
          /* Welcome screen */
          <div className="welcome-gradient relative flex flex-1 items-center justify-center overflow-hidden">
            <div className="relative z-10 text-center">
              <div className="logo-pulse mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-600 shadow-xl shadow-indigo-500/20">
                <RelayIcon className="h-10 w-10 text-white" />
              </div>

              <h2 className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
                Relay
              </h2>
              <p className="mt-2 text-[15px] text-gray-400">
                Real-time conversations, instantly.
              </p>

              <div className="mx-auto mt-8 flex items-center justify-center gap-6">
                <div className="rounded-xl bg-white/[0.04] px-5 py-3 ring-1 ring-white/[0.06]">
                  <p className="text-2xl font-bold text-white">{stats.totalRooms}</p>
                  <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-gray-500">
                    {stats.totalRooms === 1 ? "Room" : "Rooms"}
                  </p>
                </div>
                <div className="rounded-xl bg-white/[0.04] px-5 py-3 ring-1 ring-white/[0.06]">
                  <p className="text-2xl font-bold text-indigo-400">{stats.joinedRooms}</p>
                  <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-gray-500">Joined</p>
                </div>
              </div>

              <p className="mt-8 text-[13px] text-gray-500">
                Select a room to start chatting, or create a new one
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
