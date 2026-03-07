import { useCallback, useEffect, useRef, useState } from "react";
import api, { WS_BASE } from "../api";
import { useAuth } from "../context/AuthContext";
import UserList from "./UserList";

const TYPING_DEBOUNCE_MS = 300;
const TYPING_EXPIRE_MS = 2000;

export default function ChatRoom({ room }) {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [activeUserIds, setActiveUserIds] = useState([]);
  const [input, setInput] = useState("");
  const [typingUsers, setTypingUsers] = useState({});
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const reconnectTimeout = useRef(null);
  const lastTypingSent = useRef(0);
  const typingTimers = useRef({});

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [msgRes, memberRes] = await Promise.all([
          api.get(`/api/rooms/${room.id}/messages`),
          api.get(`/api/rooms/${room.id}/members`),
        ]);
        if (!cancelled) {
          setMessages(msgRes.data);
          setMembers(memberRes.data);
          setTimeout(scrollToBottom, 50);
        }
      } catch {
        /* will retry on reconnect */
      }
    }

    load();
    return () => { cancelled = true; };
  }, [room.id, scrollToBottom]);

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(`${WS_BASE}/ws/${room.id}?token=${token}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "new_message") {
          setMessages((prev) => [...prev, data]);
          setTimeout(scrollToBottom, 50);
        } else if (data.type === "user_joined") {
          setActiveUserIds(data.active_users);
          setMembers((prev) => {
            if (prev.some((m) => m.user_id === data.user_id)) return prev;
            return [...prev, { user_id: data.user_id, username: data.username, joined_at: new Date().toISOString() }];
          });
        } else if (data.type === "user_left") {
          setActiveUserIds(data.active_users);
        } else if (data.type === "typing") {
          setTypingUsers((prev) => ({ ...prev, [data.user_id]: data.username }));
          clearTimeout(typingTimers.current[data.user_id]);
          typingTimers.current[data.user_id] = setTimeout(() => {
            setTypingUsers((prev) => {
              const next = { ...prev };
              delete next[data.user_id];
              return next;
            });
          }, TYPING_EXPIRE_MS);
        }
      };

      ws.onclose = () => {
        reconnectTimeout.current = setTimeout(connect, 2000);
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimeout.current);
      Object.values(typingTimers.current).forEach(clearTimeout);
      typingTimers.current = {};
      setTypingUsers({});
      wsRef.current?.close();
    };
  }, [room.id, token, scrollToBottom]);

  function sendTypingIndicator() {
    const now = Date.now();
    if (now - lastTypingSent.current < TYPING_DEBOUNCE_MS) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    lastTypingSent.current = now;
    wsRef.current.send(JSON.stringify({ type: "typing" }));
  }

  function handleInputChange(e) {
    setInput(e.target.value);
    sendTypingIndicator();
  }

  function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ content: text }));
    setInput("");
  }

  function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Room header */}
      <div className="flex items-center border-b border-gray-700 bg-gray-800 px-6 py-3">
        <span className="mr-2 text-xl text-gray-500">#</span>
        <h2 className="text-lg font-semibold">{room.name}</h2>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Messages area */}
        <div className="flex flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {messages.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-500">
                No messages yet. Start the conversation!
              </p>
            )}
            {messages.map((msg, idx) => {
              const isOwn = msg.user_id === user.id;
              const showAuthor =
                idx === 0 || messages[idx - 1].user_id !== msg.user_id;

              return (
                <div key={msg.id ?? idx} className={`${showAuthor && idx > 0 ? "mt-4" : "mt-0.5"}`}>
                  {showAuthor && (
                    <div className="flex items-baseline gap-2">
                      <span className={`text-sm font-semibold ${isOwn ? "text-indigo-400" : "text-green-400"}`}>
                        {msg.username}
                      </span>
                      <span className="text-xs text-gray-500">{formatTime(msg.created_at)}</span>
                    </div>
                  )}
                  <p className="text-sm leading-relaxed text-gray-200">{msg.content}</p>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Typing indicator */}
          {Object.keys(typingUsers).length > 0 && (
            <div className="px-6 py-1 text-xs italic text-gray-400">
              {Object.values(typingUsers).join(", ")}{" "}
              {Object.keys(typingUsers).length === 1 ? "is" : "are"} typing...
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSend} className="border-t border-gray-700 bg-gray-800 px-6 py-3">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder={`Message #${room.name}`}
                maxLength={2000}
                className="flex-1 rounded-lg border border-gray-600 bg-gray-700 px-4 py-2.5 text-sm text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </form>
        </div>

        <UserList members={members} activeUserIds={activeUserIds} />
      </div>
    </div>
  );
}
