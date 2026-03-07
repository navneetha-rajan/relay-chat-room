import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import RoomList from "./RoomList";
import ChatRoom from "./ChatRoom";

export default function Chat() {
  const { user, logout } = useAuth();
  const [selectedRoom, setSelectedRoom] = useState(null);

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
        <RoomList selectedRoom={selectedRoom} onSelectRoom={setSelectedRoom} />
        {selectedRoom ? (
          <ChatRoom room={selectedRoom} />
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
