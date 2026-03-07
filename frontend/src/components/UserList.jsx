import { useMemo } from "react";

const AVATAR_COLORS = [
  "bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500",
  "bg-cyan-500", "bg-violet-500", "bg-orange-500", "bg-teal-500",
  "bg-pink-500", "bg-sky-500", "bg-lime-500", "bg-fuchsia-500",
];

function getAvatarColor(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function UserList({ members, activeUserIds }) {
  const sorted = useMemo(() => {
    const activeSet = new Set(activeUserIds);
    return [...members].sort((a, b) => {
      const aOnline = activeSet.has(a.user_id);
      const bOnline = activeSet.has(b.user_id);
      if (aOnline !== bOnline) return aOnline ? -1 : 1;
      return a.username.localeCompare(b.username);
    });
  }, [members, activeUserIds]);

  const activeSet = new Set(activeUserIds);
  const onlineCount = activeUserIds.length;

  return (
    <aside className="flex w-56 flex-col bg-[#2b2d31]">
      <div className="px-4 pb-2 pt-4">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
          Members
          <span className="ml-1.5 text-gray-600">
            {onlineCount > 0 && (
              <><span className="text-green-400">{onlineCount}</span> / </>
            )}
            {members.length}
          </span>
        </h2>
      </div>
      <ul className="flex-1 overflow-y-auto px-2 pb-2">
        {sorted.map((m) => {
          const online = activeSet.has(m.user_id);
          const initial = m.username.charAt(0).toUpperCase();
          const color = getAvatarColor(m.username);
          return (
            <li
              key={m.user_id}
              className={`mb-0.5 flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-all duration-150 hover:bg-white/[0.04] ${
                online ? "" : "opacity-40"
              }`}
            >
              <div className="relative flex-shrink-0">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white ${color}`}>
                  {initial}
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#2b2d31] ${
                    online ? "bg-green-400 online-pulse" : "bg-gray-600"
                  }`}
                />
              </div>
              <span className={`truncate text-[13px] ${online ? "font-medium text-gray-200" : "text-gray-400"}`}>
                {m.username}
              </span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
