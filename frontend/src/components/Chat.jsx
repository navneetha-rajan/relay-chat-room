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
      prev.map((r) => (r.id === updatedRoom.id ? updatedRoom : r)),
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

  // Keep selectedRoom in sync with rooms state
  const currentRoom = selectedRoom
    ? rooms.find((r) => r.id === selectedRoom.id) || selectedRoom
    : null;

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-6 py-3">
        <h1 className="text-lg font-bold tracking-tight">ChatRoom</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            Signed in as <span className="font-medium text-white">{user.username}</span>
          </span>
          <button
            onClick={logout}
            className="rounded-lg bg-gray-700 px-3 py-1.5 text-sm font-medium text-gray-300 transition hover:bg-gray-600 hover:text-white"
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
          <div className="flex flex-1 items-center justify-center text-gray-500">
            <div className="text-center">
              <svg
                className="mx-auto h-16 w-16 text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p className="mt-4 text-lg font-medium">Select a room to start chatting</p>
              <p className="mt-1 text-sm text-gray-600">Or create a new room from the sidebar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
