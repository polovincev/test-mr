import { useEffect, useState } from "react";
import { API_URL } from "../../config";
import { useAuth } from "../../contexts/AuthContext";

type Row = { id: number; name: string; current_text: string; default_text: string };
type Stats = {
  users: number;
  chats: number;
  messages: number;
  messages_by_role: Record<string, number>;
  chats_by_mode: Record<string, number>;
  top_chats: { chat_id: number; messages: number }[];
  recent_goals: { chat_id: number; goal: string }[];
  trajectories_count: number;
  topic_trajectories_count: number;
  tasks_total: number;
  tasks_completed: number;
  avg_completion: number;
};

export default function AdminPrompts() {
  const { token } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_URL}/admin/prompts`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = (await res.json()) as Row[];
      setRows(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/admin/stats`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        setStats(await res.json());
      } catch (e) {
        setStatsError((e as Error).message);
      }
    })();
  }, [token]);

  const save = async (name: string, text: string) => {
    try {
      const res = await fetch(`${API_URL}/admin/prompts/${encodeURIComponent(name)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ current_text: text }),
      });
      if (!res.ok) throw new Error("Save failed");
      await load();
      alert("Сохранено");
    } catch (e) {
      alert((e as Error).message);
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Загрузка…</div>;
  if (error) return <div style={{ padding: 24, color: "#b00020" }}>{error}</div>;

  return (
    <div style={{ maxWidth: 1200, margin: "40px auto", padding: 24 }}>
      <h2 style={{ margin: 0, marginBottom: 12 }}>Admin: Статистика</h2>

      {/* Stats block */}
      {statsError && (
        <div style={{ padding: 12, border: "1px solid #fca5a5", background: "#fee2e2", color: "#991b1b", borderRadius: 8, marginBottom: 16 }}>
          Ошибка загрузки статистики: {statsError}
        </div>
      )}
      {stats && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <Card title="Users" value={stats.users} />
            <Card title="Chats" value={stats.chats} />
            <Card title="Messages" value={stats.messages} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
            <Block title="Messages by role">
              {Object.entries(stats.messages_by_role).map(([k, v]) => (
                <RowView key={k} label={k} value={v} />
              ))}
            </Block>
            <Block title="Chats by mode">
              {Object.entries(stats.chats_by_mode).map(([k, v]) => (
                <RowView key={k} label={k} value={v} />
              ))}
            </Block>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
            <Block title="Top chats (by messages)">
              {stats.top_chats.map((t) => (
                <RowView key={t.chat_id} label={`Chat #${t.chat_id}`} value={t.messages} />
              ))}
            </Block>
            <Block title="Последние 20 целей">
              {stats.recent_goals.map((g, idx) => (
                <div key={`${g.chat_id}-${idx}`} style={{ padding: "6px 0", borderBottom: "1px dashed #eee" }}>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>chat #{g.chat_id}</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{g.goal}</div>
                </div>
              ))}
            </Block>
          </div>
        </div>
      )}
            <h2 style={{ marginTop: 32, marginBottom: 12 }}>Admin: Промпты</h2>
      {rows.map((r) => (
        <div key={r.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{r.name}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Default</div>
              <textarea readOnly value={r.default_text} style={{ width: "100%", minHeight: 220, whiteSpace: "pre-wrap" }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Current (editable)</div>
              <PromptEditor initial={r.current_text} onSave={(txt) => save(r.name, txt)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PromptEditor({ initial, onSave }: { initial: string; onSave: (txt: string) => void }) {
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);
  return (
    <div>
      <textarea value={value} onChange={(e) => setValue(e.target.value)} style={{ width: "100%", minHeight: 220, whiteSpace: "pre-wrap" }} />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={() => setValue(initial)}>Сбросить</button>
        <button onClick={() => onSave(value)}>Сохранить</button>
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
      <div style={{ color: "#6b7280", fontSize: 12 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginTop: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

function RowView({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px dashed #eee" }}>
      <div>{label}</div>
      <div>{value}</div>
    </div>
  );
}


