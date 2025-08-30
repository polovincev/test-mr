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
import styles from "./index.module.css";

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
  const [selected, setSelected] = useState<number>(0);
  const processorRef = useRef<any>();
  if (!processorRef.current) {
    processorRef.current = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkMath)
      .use(remarkRehype)
      .use(rehypeKatex)
      .use(rehypeStringify);
  }
  // derive topic from state if not query
  const topicState = (location.state as any)?.item?.title;
  const finalTopic = topic || topicState || "";

  const makeMockTasks = (t: string): GeneratedTask[] => [
    {
      title: `Разбор базовых понятий по теме`,
      level: 2,
      content_md:
        "Вспомним ключевые определения и простые формулы. Встроенная формула: $a^2-b^2=(a-b)(a+b)$.\n\nТаблица-шпаргалка:\n\n| Величина | Обозначение | Единицы |\n|---|---|---|\n| Площадь круга | $S$ | $\\pi r^2$ |\n| Квадрат суммы |  | $(a+b)^2=a^2+2ab+b^2$ |",
    },
    {
      title: "Практика с формулами",
      level: 3,
      content_md:
        "Реши примеры и сверяйся с формулами. Блочная запись:\n\n$$\\int_0^1 x^2\\,dx=\\frac{1}{3}$$\n\nА также соотношение Пифагора: $c^2=a^2+b^2$.",
    },
    {
      title: "Итоговое мини-задание",
      level: 4,
      content_md:
        "Сравни формулы и сделай вывод. Пример сокращённого умножения:\n\n$$a^3-b^3=(a-b)(a^2+ab+b^2)$$\n\nСписок дел:\n- [ ] Прочитать конспект\n- [x] Выполнить 3 задания\n- [ ] Сдать решение преподавателю",
    },
  ];

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      if (!chatId || !finalTopic) {
        setLoading(false);
        setTasks(makeMockTasks(finalTopic || "Тема"));
        setSelected(0);
        return;
      }
      try {
        const resp = await generateTasks(chatId, finalTopic);
        const data = Array.isArray(resp?.tasks) ? resp.tasks : [];
        if (!ignore) {
          setTasks(data.length > 0 ? data : makeMockTasks(finalTopic));
          setSelected(0);
        }
      } catch {
        if (!ignore) {
          setTasks(makeMockTasks(finalTopic));
          setSelected(0);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    run();
    return () => { ignore = true; };
  }, [chatId, finalTopic]);

  const contentRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // scroll to top when switching task
    if (contentRef.current) contentRef.current.scrollTo({ top: 0, behavior: "smooth" });
    // close any open accordions (details) inside content when switching tasks
    try {
      const root = contentRef.current;
      if (root) {
        const opened = root.querySelectorAll("details[open]");
        opened.forEach((d) => {
          try { (d as HTMLDetailsElement).open = false; } catch { /* ignore */ }
        });
      }
    } catch { /* ignore */ }
  }, [selected]);

  const current = tasks && tasks.length > 0 ? tasks[Math.min(selected, tasks.length - 1)] : null;


  return (
    <div className={styles.page}>
      {loading && <LoaderOverlay text="Формирую задания для изучения…" />}
      {!loading && (
        <>
          <button className={styles.backButton} onClick={() => navigate(`/trajectory${chatId ? `?chat_id=${chatId}` : ""}`)}>← Назад</button>
          <div className={styles.container}>
            <div className={styles.sidebar}>
              <div className={styles.sidebarTitle}>Содержание</div>
              <ul className={styles.sidebarList}>
                {(tasks || []).map((t, i) => (
                  <li
                    key={`toc-${i}`}
                    className={`${styles.sidebarItem} ${i === selected ? styles.sidebarItemActive : ""}`}
                    onClick={() => setSelected(i)}
                  >
                    {t.title}
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.content} ref={contentRef}>
              <div className={styles.progressRow}>Прогресс </div>
              <div className={styles.contentCard}>
                <div className={styles.innerWidth}>
                  <h1 style={{ marginTop: 0 }}>Задачи по теме «{finalTopic}»</h1>
                  {!current && <p>Задания не найдены.</p>}
                  {current && (
                    <div className={styles.card}>
                      <h3 style={{ margin: 0 }}>{current.title}</h3>
                      <div style={{ fontSize: 12, color: "#656C94", marginBottom: 8 }}>Уровень {current.level}</div>
                      <RenderedMarkdown processor={processorRef.current} content={current.content_md || ""} />

                      {current.level === 2 && Array.isArray((current as any).questions_to_consider) && (current as any).questions_to_consider.length > 0 && (
                        <div style={{ marginTop: 16 }}>
                          <h3 style={{ margin: "16px 0 8px 0" }}>Вопросы для размышления</h3>
                          <div className={styles.hintText}>Постарайся сначала сформулировать ответ самостоятельно, а уже потом сверяйся с подсказкой.</div>
                          <div className={styles.qaContainer}>
                            {(current as any).questions_to_consider.map((q: any, idx: number) => (
                              <details key={idx} className={styles.qaItem}>
                                <summary className={styles.qaSummary}>{String(q?.question || "Вопрос")}</summary>
                                {q?.answer && <div className={styles.qaBody} dangerouslySetInnerHTML={{ __html: String(q.answer) }} />}
                              </details>
                            ))}
                          </div>
                        </div>
                      )}

                      {current.level === 2 && Array.isArray((current as any).tests) && (current as any).tests.length > 0 && (
                        <TestsBlock tests={(current as any).tests} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className={styles.empty}></div>
          </div>
        </>)}
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
      className={"mdContent"}
    />
  );
};

const TestsBlock: React.FC<{ tests: { question: string; options: string[]; correct: number[]; hint?: string; explanation?: string }[] }>
  = ({ tests }) => {
  const [answers, setAnswers] = useState<Record<number, Set<number>>>({});
  const [checked, setChecked] = useState(false);
  const toggle = (qi: number, oi: number) => {
    setAnswers((prev) => {
      const next = { ...prev };
      const set = new Set(next[qi] ?? []);
      if (set.has(oi)) set.delete(oi); else set.add(oi);
      next[qi] = set;
      return next;
    });
  };
  const onCheck = () => setChecked(true);
  const isCorrect = (qi: number): boolean => {
    const got = Array.from(answers[qi] ?? []); got.sort();
    const need = (tests[qi].correct ?? []).slice().sort();
    return got.length === need.length && got.every((v, i) => v === need[i]);
  };
  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ margin: "16px 0 8px 0" }}>Тест</h3>
      <div className={styles.testsContainer}>
        {tests.map((t, qi) => (
          <div key={qi} className={styles.testItem}>
            <div className={styles.testQuestion}>{t.question}</div>
            <div className={styles.testOptions}>
              {t.options.map((opt, oi) => {
                const selected = answers[qi]?.has(oi) ?? false;
                return (
                  <label key={oi} className={`${styles.testOption} ${selected ? styles.testOptionSelected : ""}`}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggle(qi, oi)}
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
            {checked && (
              <div className={styles.testResult}>
                {isCorrect(qi) ? (
                  <div className={styles.testOk}>{t.explanation || "Верно"}</div>
                ) : (
                  <div className={styles.testError}>{t.hint || "Подумай ещё"}</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <button className={styles.testBtn} type="button" onClick={onCheck}>Проверить</button>
    </div>
  );
};
