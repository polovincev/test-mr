import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import LoaderOverlay from "../../components/LoaderOverlay";
import { generateTasks, type GeneratedTask } from "../../services/api";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";

const Tasks: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const chatIdParam = urlParams.get("chat_id");
  const topicParam = urlParams.get("topic") || undefined;
  return (
    <TasksInner chatId={chatIdParam ? Number(chatIdParam) : undefined} topic={topicParam} navigate={navigate} location={location} />
  );
};

const TasksInner: React.FC<{ chatId?: number; topic?: string; navigate: any; location: any }> = ({ chatId, topic, navigate, location }) => {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<GeneratedTask[] | null>(null);
  const processorRef = useRef<any>();
  if (!processorRef.current) {
    processorRef.current = unified()
      .use(remarkParse)
      .use(remarkGfm) // support tables, strikethrough, task lists
      .use(remarkMath)
      .use(remarkRehype)
      .use(rehypeKatex)
      .use(rehypeStringify);
  }
  // derive topic from state if not query
  const topicState = (location.state as any)?.item?.title;
  const finalTopic = topic || topicState || "";

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      if (!chatId || !finalTopic) {
        setLoading(false);
        setTasks([]);
        return;
      }
      try {
        const resp = await generateTasks(chatId, finalTopic);
        if (!ignore) setTasks(resp.tasks);
      } catch {
        if (!ignore) setTasks([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    run();
    return () => { ignore = true; };
  }, [chatId, finalTopic]);

  return (
    <div style={{ padding: 24, position: "relative" }}>
      <button
        onClick={() => navigate(`/trajectory${chatId ? `?chat_id=${chatId}` : ""}`)}
        style={{ marginBottom: 16, padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
      >
        ← Назад к траектории
      </button>
      {loading && <LoaderOverlay text="Формирую задания для изучения…" />}
      {!loading && (
        <>
          <h1>Задачи по теме «{finalTopic}»</h1>
          {tasks && tasks.length === 0 && <p>Задания не найдены.</p>}
          {tasks && tasks.map((t, idx) => (
            <div key={idx} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>{t.title}</h3>
              <div style={{ fontSize: 12, color: "#656C94", marginBottom: 8 }}>Уровень {t.level}</div>
              <RenderedMarkdown processor={processorRef.current} content={t.content_md || ""} />
            </div>
          ))}
        </>
      )}
    </div>
  );
};

export default Tasks;

const RenderedMarkdown: React.FC<{ processor: any; content: string }> = ({ processor, content }) => {
  const [html, setHtml] = useState<string>("");
  useEffect(() => {
    let ignore = false;
    const run = async () => {
      try {
        const file = await processor.process(content);
        if (!ignore) setHtml(String(file));
      } catch {
        if (!ignore) setHtml(content);
      }
    };
    run();
    return () => { ignore = true; };
  }, [processor, content]);
  // ensure KaTeX CSS exists
  useEffect(() => {
    if (!document.getElementById("katex-css")) {
      const link = document.createElement("link");
      link.id = "katex-css";
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";
      document.head.appendChild(link);
    }
  }, []);
  return (
    <div
      style={{ overflowX: "auto" }}
      dangerouslySetInnerHTML={{ __html: html }}
      className="md-content"
    />
  );
};
