import { useEffect, useState } from "react";
import api from "../api";

export default function RoomList({ selectedRoom, onSelectRoom }) {
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadRooms();
  }, []);

  async function loadRooms() {
    try {
      const { data } = await api.get("/api/rooms");
      setRooms(data);
    } catch {
      /* rooms will stay empty */
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const { data } = await api.post("/api/rooms", { name: newRoomName.trim() });
      setRooms((prev) => [...prev, data]);
      setNewRoomName("");
      onSelectRoom(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create room");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(room) {
    try {
      await api.post(`/api/rooms/${room.id}/join`);
      onSelectRoom(room);
    } catch {
      onSelectRoom(room);
    }
  }

  return (
    <aside className="flex w-64 flex-col border-r border-gray-700 bg-gray-800">
      <div className="border-b border-gray-700 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Rooms</h2>
      </div>

      {/* Room list */}
      <nav className="flex-1 overflow-y-auto p-2">
        {rooms.map((room) => (
          <button
            key={room.id}
            onClick={() => handleJoin(room)}
            className={`mb-1 flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
              selectedRoom?.id === room.id
                ? "bg-indigo-600 text-white"
                : "text-gray-300 hover:bg-gray-700 hover:text-white"
            }`}
          >
            <span className="mr-2 text-gray-500">#</span>
            {room.name}
          </button>
        ))}
        {rooms.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-gray-500">No rooms yet. Create one below!</p>
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
