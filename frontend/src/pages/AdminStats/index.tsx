import { useEffect, useState } from "react";
import { API_URL } from "../../config";
import { useAuth } from "../../contexts/AuthContext";

type Stats = {
  users: number;
  chats: number;
  messages: number;
  messages_by_role: Record<string, number>;
  chats_by_mode: Record<string, number>;
  top_chats: { chat_id: number; messages: number }[];
};

export default function AdminStats() {
  const { token } = useAuth();
  const [data, setData] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true); setErr(null);
      try {
        const res = await fetch(`${API_URL}/admin/stats`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        setData(await res.json());
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) return <div style={{ padding: 24 }}>Загрузка…</div>;
  if (err) return <div style={{ padding: 24, color: "#b00020" }}>{err}</div>;
  if (!data) return null;

  return (
    <div style={{ maxWidth: 1000, margin: "40px auto", padding: 24 }}>
      <h2>Admin: Stats</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <Card title="Users" value={data.users} />
        <Card title="Chats" value={data.chats} />
        <Card title="Messages" value={data.messages} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <Block title="Messages by role">
          {Object.entries(data.messages_by_role).map(([k, v]) => (
            <Row key={k} label={k} value={v} />
          ))}
        </Block>
        <Block title="Chats by mode">
          {Object.entries(data.chats_by_mode).map(([k, v]) => (
            <Row key={k} label={k} value={v} />
          ))}
        </Block>
      </div>

      <Block title="Top chats (by messages)">
        {data.top_chats.map((t) => (
          <Row key={t.chat_id} label={`Chat #${t.chat_id}`} value={t.messages} />
        ))}
      </Block>
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

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px dashed #eee" }}>
      <div>{label}</div>
      <div>{value}</div>
    </div>
  );
}


