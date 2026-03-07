import { useState } from "react";
import api from "../api";

export default function RoomList({ rooms, selectedRoom, onSelectRoom, onLeaveRoom, onJoinRoom, onRoomCreated }) {
  const [newRoomName, setNewRoomName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e) {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const { data } = await api.post("/api/rooms", { name: newRoomName.trim() });
      setNewRoomName("");
      onRoomCreated(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create room");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(e, room) {
    e.stopPropagation();
    try {
      const { data } = await api.post(`/api/rooms/${room.id}/join`);
      onJoinRoom(data);
    } catch {
      /* silent */
    }
  }

  async function handleLeave(e, room) {
    e.stopPropagation();
    try {
      await api.post(`/api/rooms/${room.id}/leave`);
      onLeaveRoom(room.id);
    } catch {
      /* silent */
    }
  }

  const joinedRooms = rooms.filter((r) => r.is_member);
  const otherRooms = rooms.filter((r) => !r.is_member);

  return (
    <aside className="flex w-64 flex-col border-r border-gray-700 bg-gray-800">
      {/* Joined rooms */}
      <div className="border-b border-gray-700 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Your Rooms</h2>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {joinedRooms.map((room) => {
          const hasUnread = room.unread_count > 0;
          return (
            <div
              key={room.id}
              className={`group mb-1 flex w-full items-center rounded-lg px-3 py-2 text-sm transition ${
                selectedRoom?.id === room.id
                  ? "bg-indigo-600 text-white"
                  : "text-gray-300 hover:bg-gray-700 hover:text-white"
              }`}
            >
              <button
                onClick={() => onSelectRoom(room)}
                className="flex flex-1 items-center text-left min-w-0"
              >
                <span className="mr-2 text-gray-500">#</span>
                <span className={`truncate ${hasUnread ? "font-bold text-white" : "font-medium"}`}>
                  {room.name}
                </span>
                {hasUnread && (
                  <span className="ml-auto flex h-5 min-w-[1.25rem] flex-shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                    {room.unread_count > 99 ? "99+" : room.unread_count}
                  </span>
                )}
              </button>
              <button
                onClick={(e) => handleLeave(e, room)}
                className="ml-1 hidden rounded bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-300 transition hover:bg-red-600 hover:text-white group-hover:block"
              >
                Leave
              </button>
            </div>
          );
        })}
        {joinedRooms.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-gray-500">Join a room below to start chatting</p>
        )}

        {/* Discoverable rooms */}
        {otherRooms.length > 0 && (
          <>
            <div className="mt-4 px-3 pb-1 pt-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Browse Rooms</h3>
            </div>
            {otherRooms.map((room) => (
              <div
                key={room.id}
                className="mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-500"
              >
                <span className="flex items-center">
                  <span className="mr-2">#</span>
                  {room.name}
                </span>
                <button
                  onClick={(e) => handleJoin(e, room)}
                  className="rounded bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-300 transition hover:bg-indigo-600 hover:text-white"
                >
                  Join
                </button>
              </div>
            ))}
          </>
        )}
      </nav>

      {/* Create room */}
      <div className="border-t border-gray-700 p-3">
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="New room"
            maxLength={100}
            className="flex-1 rounded-lg border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={creating || !newRoomName.trim()}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            +
          </button>
        </form>
        {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
      </div>
    </aside>
  );
}
