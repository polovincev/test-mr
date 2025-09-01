import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import LoaderOverlay from "../../components/LoaderOverlay";
import { generateTasks, type GeneratedTask, getTrajectory, updateTaskPassed } from "../../services/api";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import styles from "./index.module.css";
import lamp from "../../icon/lamp.png";

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
  const testCheckRef = useRef<(() => void) | null>(null);
  const [testFinished, setTestFinished] = useState(false);
  if (!processorRef.current) {
    processorRef.current = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkMath)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(rehypeKatex)
      .use(rehypeStringify, { allowDangerousHtml: true });
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
    setTestFinished(false);
    testCheckRef.current = null;
  }, [selected]);

  useEffect(() => {
    if (testFinished && contentRef.current) {
      try {
        contentRef.current.scrollTo({ top: contentRef.current.scrollHeight, behavior: "smooth" });
      } catch { /* ignore */ }
    }
  }, [testFinished]);

  const current = tasks && tasks.length > 0 ? tasks[Math.min(selected, tasks.length - 1)] : null;


  return (
    <div className={styles.page}>
      {loading && <LoaderOverlay text="Формирую задания для изучения…" />}
      {!loading && (
        <>
          <button className={styles.backButton} onClick={() => navigate(`/trajectory${chatId ? `?chat_id=${chatId}` : ""}`)}>← Назад</button>
          <div className={styles.container}>
            <div className={styles.sidebar}>
              <div className={styles.sidebarTitle}>Описание</div>
              <ul className={styles.sidebarList}>
                {(tasks || []).map((t, i) => (
                  <li
                    key={`toc-${i}`}
                    className={`${styles.sidebarItem} ${i === selected ? styles.sidebarItemActive : ""}`}
                    onClick={() => setSelected(i)}
                  >
                    {t.passed ? <span className={styles.sidebarOk} /> : null}
                    {t.title}
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.content}>
              {Array.isArray(tasks) && tasks.length > 0 && (
                (() => {
                  const filtered = tasks.filter((t) => {
                    const title = String((t as any)?.title || "").toLowerCase();
                    return !title.includes("тест по базовому уровню");
                  });
                  const total = filtered.length;
                  const done = filtered.reduce((acc, t) => acc + ((t as any).passed ? 1 : 0), 0);
                  return (
                    <div className={styles.progressRow}>
                      <span className={styles.taskProgressText}>Готово {done} из {total}</span>
                      <div className={styles.taskProgressBar}>
                        <div className={styles.taskProgressInner} style={{ width: `${total ? Math.min(100, Math.round((done / total) * 100)) : 0}%` }} />
                      </div>
                    </div>
                  );
                })()
              )}
              <div className={styles.contentCard} ref={contentRef}>
                <div className={styles.innerWidth}>
                  {!current && <p>Задания не найдены.</p>}
                  {current && (
                    <div className={styles.card}>
                      <div className={styles.levelBadge}>
                        {current.level === 2 && "Базовый уровень • " + finalTopic}
                        {current.level === 3 && "Уверенный уровень • " + finalTopic}
                        {current.level === 4 && "Продвинутый уровень • " + finalTopic}
                      </div>
                      <RenderedMarkdown processor={processorRef.current} content={current.content_md || ""} />

                      {current.level === 2 && Array.isArray((current as any).questions_to_consider) && (current as any).questions_to_consider.length > 0 && (
                        <div style={{ marginTop: 16 }}>
                          <div className={styles.sectionTitle}>Вопросы для размышления</div>
                          <div className={styles.hintText}>Постарайся сначала сформулировать ответ самостоятельно, а уже потом сверяйся с подсказкой.</div>
                          <div className={styles.qaContainer}>
                            {(current as any).questions_to_consider.map((q: any, idx: number) => (
                              <details key={idx} className={styles.qaItem}>
                                <summary className={styles.qaSummary}>{String(q?.question || "Вопрос")}</summary>
                                {q?.answer && (
                                  <div
                                    className={styles.qaBody}
                                    onClick={(e) => {
                                      try {
                                        const d = (e.currentTarget.closest("details") as HTMLDetailsElement | null);
                                        if (d) d.open = false;
                                      } catch { /* ignore */ }
                                    }}
                                    dangerouslySetInnerHTML={{ __html: String(q.answer) }}
                                  />
                                )}
                              </details>
                            ))}
                          </div>
                        </div>
                      )}

                      {current.level === 2 && Array.isArray((current as any).tests) && (current as any).tests.length > 0 && (
                        <TestsBlock
                          key={selected}
                          tests={(current as any).tests}
                          onAttachCheckHandler={(fn) => { testCheckRef.current = fn; }}
                          onChecked={() => setTestFinished(true)}
                        />
                      )}
                      <div className={styles.footer}>
                        <button
                          type="button"
                          className={styles.toMyBtn}
                          onClick={async () => {
                            try {
                              if (typeof chatId === "number") {
                                const tr = await getTrajectory(chatId);
                                navigate('/my', { state: { trajectory: tr, chatId } });
                              } else {
                                navigate('/my');
                              }
                            } catch {
                              navigate('/my');
                            }
                          }}
                        >
                          В метаучебник
                        </button>
                        {Array.isArray((current as any).tests) && (current as any).tests.length > 0 && (
                          testFinished && (tasks && selected < (tasks.length - 1)) ? (
                            <button
                              type="button"
                              className={styles.testBtn}
                              onClick={async () => {
                                try {
                                  if (typeof chatId === 'number') {
                                    await updateTaskPassed(chatId, finalTopic, selected, true);
                                  }
                                } catch {}
                                setTasks((prev) => {
                                  if (!prev) return prev;
                                  const next = prev.slice();
                                  if (next[selected]) next[selected] = { ...next[selected], passed: true } as any;
                                  return next;
                                });
                                setSelected((s) => Math.min(s + 1, (tasks || []).length - 1));
                              }}
                            >
                              Далее
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={styles.testBtn}
                              onClick={async () => {
                                try { testCheckRef.current && testCheckRef.current(); } catch { }
                                try {
                                  const title = String((current as any)?.title || "").toLowerCase();
                                  const isL2 = Number((current as any)?.level) === 2;
                                  const isLast = Array.isArray(tasks) && selected === (tasks.length - 1);
                                  const isTest = title.includes("тест");
                                  if (isL2 && isLast && isTest && typeof chatId === 'number') {
                                      await updateTaskPassed(chatId, finalTopic, selected, true);
                                      setTasks((prev) => {
                                        if (!prev) return prev;
                                        const next = prev.slice();
                                        if (next[selected]) next[selected] = { ...next[selected], passed: true } as any;
                                        return next;
                                      });
                                  }
                                } catch {}
                              }}
                            >
                              Проверить
                            </button>
                          )
                        )}
                        {!(Array.isArray((current as any).tests) && (current as any).tests.length > 0) && (current.level === 3 || current.level === 4) && (
                          <button
                            type="button"
                            className={styles.testBtn}
                            onClick={async () => {
                              try {
                                if (typeof chatId === 'number') {
                                  await updateTaskPassed(chatId, finalTopic, selected, true);
                                }
                              } catch {}
                              setTasks((prev) => {
                                if (!prev) return prev;
                                const next = prev.slice();
                                if (next[selected]) next[selected] = { ...next[selected], passed: true } as any;
                                return next;
                              });
                              if (tasks && selected < (tasks.length - 1)) {
                                setSelected((s) => Math.min(s + 1, (tasks || []).length - 1));
                              }
                            }}
                          >
                            Загрузить ответ
                          </button>
                        )}
                      </div>
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
        const pre = String(content || "")
          .replace(/\r\n/g, "\n")
          // ensure markdown resumes normally after details blocks
          .replace(/<\/details>\s*(?!\n\n)/g, "</details>\n\n");
        const file = await processor.process(pre);
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
      className={styles.mdContent}
    />
  );
};

const TestsBlock: React.FC<{ tests: { question: string; options: string[]; correct: number[]; hint?: string; explanation?: string }[]; onAttachCheckHandler?: (fn: () => void) => void; onChecked?: () => void }>
  = ({ tests, onAttachCheckHandler, onChecked }) => {
    const [answers, setAnswers] = useState<Record<number, Set<number>>>({});
    const [checked, setChecked] = useState(false);
    const toggle = (qi: number, oi: number, single: boolean) => {
      setAnswers((prev) => {
        const next = { ...prev };
        const set = new Set(next[qi] ?? []);
        if (single) {
          next[qi] = new Set([oi]);
          return next;
        }
        if (set.has(oi)) set.delete(oi); else set.add(oi);
        next[qi] = set;
        return next;
      });
    };
    const onCheck = () => {
      setChecked(true);
      try { onChecked && onChecked(); } catch { /* ignore */ }
    };
    useEffect(() => {
      try { onAttachCheckHandler && onAttachCheckHandler(() => onCheck()); } catch { }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const isCorrect = (qi: number): boolean => {
      const got = Array.from(answers[qi] ?? []); got.sort();
      const need = (tests[qi].correct ?? []).slice().sort();
      return got.length === need.length && got.every((v, i) => v === need[i]);
    };
    return (
      <>
        <div className={styles.separator}></div>
        <div style={{ marginTop: 24 }}>
          <div className={styles.testsContainer}>
            {tests.map((t, qi) => (
              <div key={qi} className={styles.testItem}>
                <div className={styles.testQuestion}>{t.question}</div>
                <div className={styles.testChoiceHint}>
                  {(Array.isArray(t.correct) && t.correct.length === 1) ? "Выбери один вариант" : "Выбери несколько вариантов"}
                </div>
                <div className={styles.testOptions}>
                  {t.options.map((opt, oi) => {
                    const selected = answers[qi]?.has(oi) ?? false;
                    const single = Array.isArray(t.correct) && t.correct.length === 1;
                    const optionCorrect = Array.isArray(t.correct) && t.correct.includes(oi);
                    const classes = [styles.testOption];
                    if (selected) classes.push(styles.testOptionSelected);
                    if (checked && selected && optionCorrect) classes.push(styles.testOptionRight);
                    if (checked && selected && !optionCorrect) classes.push(styles.testOptionWrong);
                    return (
                      <label key={oi} className={classes.join(" ")}>
                        <input
                          type={single ? "radio" : "checkbox"}
                          name={`test-${qi}`}
                          checked={selected}
                          disabled={checked}
                          onChange={() => { if (checked) return; toggle(qi, oi, single); }}
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>
                {checked && (
                  <div className={styles.testResult}>
                    {t.explanation && (
                      <div className={styles.explBlock}>
                        <img className={styles.explIcon} src={lamp} alt="" />
                        <div className={styles.explTitle}>Объяснение</div>
                        <div className={styles.explText}>{t.explanation}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </>
    );
  };
