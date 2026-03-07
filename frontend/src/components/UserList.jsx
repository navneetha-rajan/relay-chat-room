export default function UserList({ members, activeUserIds }) {
  const activeSet = new Set(activeUserIds);

  const sorted = [...members].sort((a, b) => {
    const aOnline = activeSet.has(a.user_id);
    const bOnline = activeSet.has(b.user_id);
    if (aOnline !== bOnline) return aOnline ? -1 : 1;
    return a.username.localeCompare(b.username);
  });

  return (
    <aside className="flex w-56 flex-col border-l border-gray-700 bg-gray-800">
      <div className="border-b border-gray-700 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
          Members — {members.length}
        </h2>
      </div>
      <ul className="flex-1 overflow-y-auto p-2">
        {sorted.map((m) => {
          const online = activeSet.has(m.user_id);
          return (
            <li key={m.user_id} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  online ? "bg-green-400" : "bg-gray-600"
                }`}
              />
              <span className={online ? "font-medium text-white" : "text-gray-500"}>
                {m.username}
              </span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
