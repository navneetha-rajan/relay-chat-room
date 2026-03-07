import { useCallback, useEffect, useRef, useState } from "react";
import api, { WS_BASE } from "../api";
import { useAuth } from "../context/AuthContext";
import UserList from "./UserList";

const TYPING_DEBOUNCE_MS = 300;
const TYPING_EXPIRE_MS = 2000;

export default function ChatRoom({ room, onJoinRoom }) {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [activeUserIds, setActiveUserIds] = useState([]);
  const [input, setInput] = useState("");
  const [typingUsers, setTypingUsers] = useState({});
  const [joining, setJoining] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [unreadDividerAfterId, setUnreadDividerAfterId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const dividerRef = useRef(null);
  const reconnectTimeout = useRef(null);
  const lastTypingSent = useRef(0);
  const typingTimers = useRef({});
  const isNearBottom = useRef(true);

  function checkIfNearBottom() {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 100;
    isNearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    if (isNearBottom.current && unreadDividerAfterId !== null) {
      clearUnread();
    }
  }

  const scrollToBottom = useCallback((force = false) => {
    if (!force && !isNearBottom.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  function clearUnread() {
    if (unreadDividerAfterId === null) return;
    setUnreadDividerAfterId(null);
    setUnreadCount(0);
    api.post(`/api/rooms/${room.id}/read`).catch(() => {});
  }

  useEffect(() => {
    if (!room.is_member) return;
    let cancelled = false;

    async function load() {
      try {
        const [msgRes, memberRes] = await Promise.all([
          api.get(`/api/rooms/${room.id}/messages`),
          api.get(`/api/rooms/${room.id}/members`),
        ]);
        if (cancelled) return;

        const { messages: msgs, last_read_message_id } = msgRes.data;
        setMessages(msgs);
        setMembers(memberRes.data);

        if (last_read_message_id != null && msgs.length > 0) {
          const lastReadIdx = msgs.findIndex((m) => m.id === last_read_message_id);
          const hasUnread = lastReadIdx >= 0 && lastReadIdx < msgs.length - 1;

          if (hasUnread) {
            const count = msgs.length - 1 - lastReadIdx;
            setUnreadDividerAfterId(last_read_message_id);
            setUnreadCount(count);
            setTimeout(() => {
              dividerRef.current?.scrollIntoView({ behavior: "auto", block: "center" });
            }, 50);
          } else {
            setUnreadDividerAfterId(null);
            setUnreadCount(0);
            setTimeout(() => scrollToBottom(true), 50);
          }
        } else if (last_read_message_id == null && msgs.length > 0) {
          setUnreadDividerAfterId(0);
          setUnreadCount(msgs.length);
          setTimeout(() => {
            dividerRef.current?.scrollIntoView({ behavior: "auto", block: "center" });
          }, 50);
        } else {
          setTimeout(() => scrollToBottom(true), 50);
        }
      } catch {
        /* will retry on reconnect */
      }
    }

    load();
    return () => { cancelled = true; };
  }, [room.id, room.is_member, scrollToBottom]);

  useEffect(() => {
    if (!room.is_member) return;
    let intentionalClose = false;

    function connect() {
      const ws = new WebSocket(`${WS_BASE}/ws/${room.id}?token=${token}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "new_message") {
          setMessages((prev) => [...prev, data]);
          setTimeout(scrollToBottom, 50);
        } else if (data.type === "active_users") {
          setActiveUserIds(data.active_users);
        } else if (data.type === "user_joined") {
          setActiveUserIds(data.active_users);
          setMembers((prev) => {
            if (prev.some((m) => m.user_id === data.user_id)) return prev;
            return [...prev, { user_id: data.user_id, username: data.username, joined_at: new Date().toISOString() }];
          });
        } else if (data.type === "user_left") {
          setActiveUserIds(data.active_users);
        } else if (data.type === "message_deleted") {
          setMessages((prev) => prev.filter((m) => m.id !== data.message_id));
          setConfirmingDeleteId((prev) => (prev === data.message_id ? null : prev));
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
        if (!intentionalClose) {
          reconnectTimeout.current = setTimeout(connect, 2000);
        }
      };
    }

    connect();

    return () => {
      intentionalClose = true;
      clearTimeout(reconnectTimeout.current);
      Object.values(typingTimers.current).forEach(clearTimeout);
      typingTimers.current = {};
      setTypingUsers({});
      setActiveUserIds([]);
      wsRef.current?.close();
    };
  }, [room.id, room.is_member, token, scrollToBottom]);

  useEffect(() => {
    setMessages([]);
    setMembers([]);
    setActiveUserIds([]);
    setInput("");
    setTypingUsers({});
    setUnreadDividerAfterId(null);
    setUnreadCount(0);
  }, [room.id]);

  // Mark as read when leaving the room
  useEffect(() => {
    return () => {
      api.post(`/api/rooms/${room.id}/read`).catch(() => {});
    };
  }, [room.id]);

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

  async function handleJoin() {
    setJoining(true);
    try {
      const { data } = await api.post(`/api/rooms/${room.id}/join`);
      onJoinRoom(data);
    } catch {
      /* silent */
    } finally {
      setJoining(false);
    }
  }

  async function handleDelete(messageId) {
    try {
      await api.delete(`/api/messages/${messageId}`);
    } catch {
      /* WS broadcast handles removal even on error */
    }
    setConfirmingDeleteId(null);
  }

  if (!room.is_member) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center border-b border-gray-700 bg-gray-800 px-6 py-3">
          <span className="mr-2 text-xl text-gray-500">#</span>
          <h2 className="text-lg font-semibold">{room.name}</h2>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-700">
              <span className="text-2xl text-gray-400">#</span>
            </div>
            <h3 className="text-xl font-semibold">{room.name}</h3>
            <p className="mt-2 text-sm text-gray-400">Join this room to view messages and start chatting</p>
            <button
              onClick={handleJoin}
              disabled={joining}
              className="mt-6 rounded-lg bg-indigo-600 px-6 py-2.5 font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {joining ? "Joining..." : "Join Room"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Determine where the divider goes: after message with id === unreadDividerAfterId
  // Special case: unreadDividerAfterId === 0 means ALL messages are unread (divider before first message)
  const dividerBeforeIndex =
    unreadDividerAfterId === null
      ? -1
      : unreadDividerAfterId === 0
        ? 0
        : messages.findIndex((m) => m.id === unreadDividerAfterId) + 1;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center border-b border-gray-700 bg-gray-800 px-6 py-3">
        <span className="mr-2 text-xl text-gray-500">#</span>
        <h2 className="text-lg font-semibold">{room.name}</h2>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col">
          <div ref={scrollContainerRef} onScroll={checkIfNearBottom} className="flex-1 overflow-y-auto px-6 py-4">
            {messages.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-500">
                No messages yet. Start the conversation!
              </p>
            )}
            {messages.map((msg, idx) => {
              const isOwn = msg.user_id === user.id;
              const showAuthor = idx === 0 || messages[idx - 1].user_id !== msg.user_id;
              const showDivider = dividerBeforeIndex === idx && dividerBeforeIndex > 0 && unreadCount > 0;
              const showDividerAtTop = dividerBeforeIndex === 0 && idx === 0 && unreadCount > 0;

              return (
                <div key={msg.id ?? idx}>
                  {showDividerAtTop && (
                    <div ref={dividerRef} className="my-3 flex items-center gap-3">
                      <div className="h-px flex-1 bg-red-500/60" />
                      <span className="whitespace-nowrap text-xs font-semibold text-red-400">
                        {unreadCount} NEW {unreadCount === 1 ? "MESSAGE" : "MESSAGES"}
                      </span>
                      <div className="h-px flex-1 bg-red-500/60" />
                    </div>
                  )}
                  {showDivider && (
                    <div ref={dividerRef} className="my-3 flex items-center gap-3">
                      <div className="h-px flex-1 bg-red-500/60" />
                      <span className="whitespace-nowrap text-xs font-semibold text-red-400">
                        {unreadCount} NEW {unreadCount === 1 ? "MESSAGE" : "MESSAGES"}
                      </span>
                      <div className="h-px flex-1 bg-red-500/60" />
                    </div>
                  )}
                  <div className={`group/msg relative ${showAuthor && idx > 0 ? "mt-4" : "mt-0.5"}`}>
                    {showAuthor && (
                      <div className="flex items-baseline gap-2">
                        <span className={`text-sm font-semibold ${isOwn ? "text-indigo-400" : "text-green-400"}`}>
                          {msg.username}
                        </span>
                        <span className="text-xs text-gray-500">{formatTime(msg.created_at)}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-1">
                      <p className="min-w-0 flex-1 text-sm leading-relaxed text-gray-200">{msg.content}</p>
                      {isOwn && confirmingDeleteId !== msg.id && (
                        <button
                          onClick={() => setConfirmingDeleteId(msg.id)}
                          className="mt-0.5 flex-shrink-0 rounded p-1 text-gray-500 opacity-0 transition hover:bg-gray-700 hover:text-red-400 group-hover/msg:opacity-100"
                          title="Delete message"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {confirmingDeleteId === msg.id && (
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        <span className="text-gray-400">Delete this message?</span>
                        <button
                          onClick={() => handleDelete(msg.id)}
                          className="rounded bg-red-600 px-2 py-0.5 font-medium text-white transition hover:bg-red-500"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmingDeleteId(null)}
                          className="rounded bg-gray-600 px-2 py-0.5 font-medium text-gray-300 transition hover:bg-gray-500"
                        >
                          No
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {Object.keys(typingUsers).length > 0 && (
            <div className="px-6 py-1 text-xs italic text-gray-400">
              {Object.values(typingUsers).join(", ")}{" "}
              {Object.keys(typingUsers).length === 1 ? "is" : "are"} typing...
            </div>
          )}

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
