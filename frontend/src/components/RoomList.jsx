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
    <aside className="flex w-64 flex-col bg-[#1e1f22]">
      <div className="px-4 pb-2 pt-4">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Your Rooms</h2>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {joinedRooms.map((room) => {
          const hasUnread = room.unread_count > 0;
          const isActive = selectedRoom?.id === room.id;
          return (
            <div
              key={room.id}
              className={`animate-slide-in group mb-0.5 flex w-full items-center rounded-md px-2 py-1.5 text-sm transition-all duration-150 ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:bg-white/[0.06] hover:text-gray-200"
              }`}
            >
              <button
                onClick={() => onSelectRoom(room)}
                className="flex flex-1 items-center text-left min-w-0 gap-1.5"
              >
                <span className={`text-lg leading-none ${isActive ? "text-gray-300" : "text-gray-600"}`}>#</span>
                <span className={`truncate ${hasUnread ? "font-semibold text-white" : isActive ? "font-medium" : ""}`}>
                  {room.name}
                </span>
                {hasUnread && (
                  <span className="ml-auto flex h-[18px] min-w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                    {room.unread_count > 99 ? "99+" : room.unread_count}
                  </span>
                )}
              </button>
              <button
                onClick={(e) => handleLeave(e, room)}
                className="ml-1 hidden rounded px-1.5 py-0.5 text-[10px] font-medium text-gray-500 transition-all duration-150 hover:bg-red-500/20 hover:text-red-400 group-hover:block"
              >
                Leave
              </button>
            </div>
          );
        })}

        {joinedRooms.length === 0 && (
          <div className="flex flex-col items-center px-3 py-8 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
              <span className="text-lg text-gray-600">#</span>
            </div>
            <p className="text-xs text-gray-500">No rooms yet</p>
            <p className="mt-0.5 text-[11px] text-gray-600">Join or create one below</p>
          </div>
        )}

        {otherRooms.length > 0 && (
          <>
            <div className="mt-5 px-2 pb-1">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Browse Rooms</h3>
            </div>
            {otherRooms.map((room) => (
              <div
                key={room.id}
                className="animate-slide-in mb-0.5 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm text-gray-500 transition-all duration-150 hover:bg-white/[0.04]"
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="text-lg leading-none text-gray-600">#</span>
                  <span className="truncate">{room.name}</span>
                </span>
                <button
                  onClick={(e) => handleJoin(e, room)}
                  className="flex-shrink-0 rounded-md bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-400 transition-all duration-150 hover:bg-indigo-500 hover:text-white"
                >
                  Join
                </button>
              </div>
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-white/[0.06] p-3">
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="New room name..."
            maxLength={100}
            className="flex-1 rounded-md border border-white/[0.06] bg-white/[0.04] px-3 py-1.5 text-sm text-white placeholder-gray-500 transition-all duration-150 focus:border-indigo-500/50 focus:bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
          />
          <button
            type="submit"
            disabled={creating || !newRoomName.trim()}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-all duration-150 hover:bg-indigo-500 disabled:opacity-30"
          >
            +
          </button>
        </form>
        {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
      </div>
    </aside>
  );
}
