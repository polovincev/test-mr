import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import LoaderOverlay from "../../components/LoaderOverlay";
import { generateTasks, type GeneratedTask, getTrajectory, updateTaskPassed, type TestAnswerPayload } from "../../services/api";
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
  const testCheckRef = useRef<(() => boolean) | null>(null);
  const checkBusyRef = useRef<boolean>(false);
  const [testFinished, setTestFinished] = useState(false);
  const [testFailed, setTestFailed] = useState(false);
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
        const mk = makeMockTasks(finalTopic || "Тема");
        setTasks(mk);
        setSelected(0);
        return;
      }
      try {
        const resp = await generateTasks(chatId, finalTopic);
        const data = Array.isArray(resp?.tasks) ? resp.tasks : [];
        if (!ignore) {
          const list = data.length > 0 ? data : makeMockTasks(finalTopic);
          setTasks(list);
          const firstNotPassed = list.findIndex((t: any) => !t?.passed);
          setSelected(firstNotPassed >= 0 ? firstNotPassed : 0);
        }
      } catch {
        if (!ignore) {
          const mk = makeMockTasks(finalTopic);
          setTasks(mk);
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
    setTestFailed(false);
  }, [selected]);

  useEffect(() => {
    if (testFinished && contentRef.current) {
      try {
        contentRef.current.scrollTo({ top: contentRef.current.scrollHeight, behavior: "smooth" });
      } catch { /* ignore */ }
    }
  }, [testFinished]);

  const current = tasks && tasks.length > 0 ? tasks[Math.min(selected, tasks.length - 1)] : null;

  // If task already passed and it is a test → mark as finished to show hints and "Далее"
  useEffect(() => {
    try {
      const isTest = !!(current && Array.isArray((current as any).tests) && (current as any).tests.length > 0);
      if (isTest && (current as any)?.passed) {
        setTestFinished(true);
        setTestFailed(false);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);


  return (
    <div className={styles.page}>
      {loading && <LoaderOverlay text="Формирую задания для изучения…" />}
      {!loading && (
        <>
          <button className={styles.backButton} onClick={() => navigate(`/trajectory${chatId ? `?chat_id=${chatId}` : ""}`)}>← Назад</button>
          <div className={styles.container}>
            <div className={styles.sidebar}>
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
                          processor={processorRef.current}
                          tests={(current as any).tests}
                          initialAnswers={(() => {
                            try {
                              const list = (current as any).tests as any[];
                              const map: Record<number, number[]> = {};
                              list.forEach((t, i) => { if (Array.isArray(t?.answer)) map[i] = t.answer as number[]; });
                              return map;
                            } catch { return undefined as any; }
                          })()}
                          initialChecked={Boolean((current as any)?.passed)}
                          onAttachCheckHandler={(fn) => { testCheckRef.current = fn; }}
                          onChecked={() => setTestFinished(true)}
                          suppressExplanation={(() => {
                            const title = String((current as any)?.title || "").toLowerCase();
                            return title.includes("тест по теме") || title.includes("тест по базовому уровню");
                          })()}
                          onSkip={() => {
                            if (tasks && selected < (tasks.length - 1)) {
                              setSelected((s) => Math.min(s + 1, (tasks || []).length - 1));
                            }
                          }}
                          onFailChange={(v) => setTestFailed(Boolean(v))}
                          enableFailPanel={(() => {
                            const title = String((current as any)?.title || "").toLowerCase();
                            return title.includes("тест по базовому уровню");
                          })()}
                          onReset={() => setTestFinished(false)}
                        />
                      )}
                      <div className={styles.footer}>
                        {(() => {
                          const hasTests = Array.isArray((current as any).tests) && (current as any).tests.length > 0;
                          if (!hasTests || (hasTests && !testFailed)) {
                            return (
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
                            );
                          }
                          return null;
                        })()}
                        {/* --- ACTION BUTTONS --- */}
                        {(() => {
                          const isTest = Array.isArray((current as any).tests) && (current as any).tests.length > 0;
                          const titleLc = String((current as any)?.title || "").toLowerCase();
                          const isBaseTest = isTest && titleLc.includes("тест по базовому уровню");
                          const hasNext = tasks && selected < (tasks.length - 1);

                          // LEVEL 2 TESTS (including base test)
                          if (isTest && current.level === 2) {
                            // Still not checked -> show "Проверить"
                            if (!testFinished) {
                              return (
                                <button type="button" className={styles.testBtn} onClick={async () => {
                                  if (checkBusyRef.current) return;
                                  checkBusyRef.current = true;
                                  let needRetry = false;
                                  try { needRetry = testCheckRef.current ? Boolean(testCheckRef.current()) : false; } catch {}

                                  // If base test is last item and passed -> update backend immediately
                                  if (isBaseTest && !needRetry && !hasNext && typeof chatId === 'number') {
                                    // collect user's answers for ALL questions (use document root to avoid scoping issues)
                                    let packed: TestAnswerPayload[] | undefined = undefined;
                                    try {
                                      const total = Array.isArray((current as any).tests) ? (current as any).tests.length : 0;
                                      const answers: TestAnswerPayload[] = [];
                                      for (let qi = 0; qi < total; qi++) {
                                        const inputs = document.querySelectorAll(`input[name="test-${qi}"]`);
                                        const arr: number[] = [];
                                        inputs.forEach((inp, idx) => { const el = inp as HTMLInputElement; if (el.checked) arr.push(idx); });
                                        answers.push({ index: qi, answer: arr });
                                      }
                                      packed = answers;
                                    } catch {}
                                    try { await updateTaskPassed(chatId, finalTopic, selected, true, packed); } catch {}
                                    setTasks((prev) => {
                                      if (!prev) return prev;
                                      const next = prev.slice();
                                      if (next[selected]) next[selected] = { ...next[selected], passed: true } as any;
                                      return next;
                                    });
                                  }

                                  checkBusyRef.current = false;
                                }}>Проверить</button>
                              );
                            }

                            // Checked, decide if retry needed for base test
                            if (isBaseTest && testFailed) {
                              return null; // retry panel already visible, no buttons
                            }

                            // Ready to go next or finished
                            return hasNext ? (
                              <button type="button" className={styles.testBtn} onClick={async () => {
                                // mark passed and move next
                                if (typeof chatId === 'number') {
                                  // collect user's answers for ALL questions (use document root to avoid scoping issues)
                                  let packed: TestAnswerPayload[] | undefined = undefined;
                                  try {
                                    const total = Array.isArray((current as any).tests) ? (current as any).tests.length : 0;
                                    const answers: TestAnswerPayload[] = [];
                                    for (let qi = 0; qi < total; qi++) {
                                      const inputs = document.querySelectorAll(`input[name="test-${qi}"]`);
                                      const arr: number[] = [];
                                      inputs.forEach((inp, idx) => { const el = inp as HTMLInputElement; if (el.checked) arr.push(idx); });
                                      answers.push({ index: qi, answer: arr });
                                    }
                                    packed = answers;
                                  } catch {}
                                  try { await updateTaskPassed(chatId, finalTopic, selected, true, packed); } catch {}
                                }
                                setTasks((prev) => {
                                  if (!prev) return prev;
                                  const next = prev.slice();
                                  if (next[selected]) next[selected] = { ...next[selected], passed: true } as any;
                                  return next;
                                });
                                setSelected((s) => Math.min(s + 1, (tasks || []).length - 1));
                              }}>Далее</button>
                            ) : null; // last item handled by ToMyBtn
                          }

                          // LEVEL 3/4 TASKS (non-test)
                          if (!isTest && (current.level === 3 || current.level === 4)) {
                            return (
                              <button type="button" className={styles.testBtn} onClick={async () => {
                                if (typeof chatId === 'number') {
                                  try { await updateTaskPassed(chatId, finalTopic, selected, true); } catch {}
                                }
                                setTasks((prev) => {
                                  if (!prev) return prev;
                                  const next = prev.slice();
                                  if (next[selected]) next[selected] = { ...next[selected], passed: true } as any;
                                  return next;
                                });
                                if (hasNext) setSelected((s) => Math.min(s + 1, (tasks || []).length - 1));
                              }}>Загрузить ответ</button>
                            );
                          }

                          return null;
                        })()}
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
        let pre = String(content || "")
          .replace(/\r\n/g, "\n")
          // ensure markdown resumes normally after details blocks
          .replace(/<\/details>\s*(?!\n\n)/g, "</details>\n\n");
        // strip <b> tags inside <summary>...</summary> only
        try {
          pre = pre.replace(/<summary([^>]*)>([\s\S]*?)<\/summary>/gi, (_m, attrs, inner) => {
            const cleaned = String(inner).replace(/<\/?b>/gi, "");
            return `<summary${attrs}>${cleaned}</summary>`;
          });
        } catch { /* ignore */ }
        // force blank line after </summary> so following plain text becomes <p>
        pre = pre.replace(/<\/summary>\s*(?!\n\n)/gi, "</summary>\n\n");
        // ensure content before </details> ends with a newline for consistent block parsing
        pre = pre.replace(/([^\n])\s*<\/details>/gi, "$1\n</details>");
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

const TestsBlock: React.FC<{ processor?: any; tests: { question: string; options: string[]; correct: number[]; hint?: string; explanation?: string; answer?: number[] }[]; onAttachCheckHandler?: (fn: () => boolean) => void; onChecked?: () => void; suppressExplanation?: boolean; onSkip?: () => void; onFailChange?: (failed: boolean) => void; enableFailPanel?: boolean; onReset?: () => void; initialAnswers?: Record<number, number[]>; initialChecked?: boolean }>
  = ({ processor, tests, onAttachCheckHandler, onChecked, suppressExplanation, onSkip, onFailChange, enableFailPanel, onReset, initialAnswers, initialChecked }) => {
    const [answers, setAnswers] = useState<Record<number, Set<number>>>(() => {
      const map: Record<number, Set<number>> = {};
      try {
        if (initialAnswers) {
          Object.keys(initialAnswers).forEach((k) => { map[Number(k)] = new Set(initialAnswers[Number(k)] || []); });
        }
      } catch { /* ignore */ }
      return map;
    });
    const [checked, setChecked] = useState(Boolean(initialChecked));
    const [correctCount, setCorrectCount] = useState<number>(0);
    const [failed, setFailed] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);
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
        console.log("TOGGLE:", { qi, oi, single, after: Array.from(next[qi] ?? []) });
        return next;
      });
    };
    const onCheck = (): boolean => {
      console.log("ONCHECK: start");
      setChecked(true);
      try {
        // compute score (source of truth: DOM selections to avoid stale state)
        let ok = 0;
        const container = rootRef.current;
        for (let qi = 0; qi < tests.length; qi++) {
          let got: number[] = [];
          try {
            const inputs = container?.querySelectorAll(`input[name="test-${qi}"]`);
            if (inputs) {
              inputs.forEach((inp, idx) => {
                const el = inp as HTMLInputElement;
                if (el.checked) got.push(idx);
              });
            }
          } catch { /* ignore */ }
          got = got.slice().sort((a, b) => a - b);
          const need = (tests[qi].correct ?? []).slice().sort((a, b) => a - b);
          const isRight = got.length === need.length && got.every((v, i) => v === need[i]);
          console.log("ONCHECK: qi=", qi, { got, need, isRight });
          if (isRight) ok += 1;
        }
        console.log("ONCHECK: correctCount=", ok);
        setCorrectCount(ok);
        const needRetry = Boolean(enableFailPanel) && ok < 3;
        console.log("ONCHECK: needRetry=", needRetry, "enableFailPanel=", enableFailPanel);
        setFailed(needRetry);
        try { onFailChange && onFailChange(needRetry); } catch {}
        try { onChecked && onChecked(); } catch { /* ignore */ }
        return needRetry;
      } catch { /* ignore */ }
      try { onChecked && onChecked(); } catch { /* ignore */ }
      return true;
    };
    useEffect(() => {
      try {
        onAttachCheckHandler && onAttachCheckHandler(() => onCheck());
        console.log("ATTACH: testCheckRef attached");
      } catch { }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const needToRetry = failed;
    const retry = () => {
      console.log("RETRY: reset");
      setAnswers({});
      setChecked(false);
      setCorrectCount(0);
      setFailed(false);
      try { onFailChange && onFailChange(false); } catch {}
      try { onReset && onReset(); } catch {}
    };
    return (
      <>
        <div className={styles.separator}></div>
        <div style={{ marginTop: 24 }}>
          <div className={styles.testsContainer} ref={rootRef}>
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
                        <span dangerouslySetInnerHTML={{ __html: (() => {
                          try {
                            const md = String(opt || "").replace(/\r\n/g, "\n");
                            const file = (processor as any)?.processSync ? (processor as any).processSync(md) : md;
                            return String(file);
                          } catch { return String(opt || ""); }
                        })() }} />
                      </label>
                    );
                  })}
                </div>
                {checked && !suppressExplanation && (
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
          {needToRetry && (
            <div className={styles.failPanel}>
              <div className={styles.failTitle}>Пока базовый уровень не освоен — попробуй ещё раз</div>
              <div className={styles.failSubtitle}>Чтобы мы зачли тест, ответь правильно больше, чем на половину вопросов</div>
              <div className={styles.failActions}>
                <button type="button" onClick={retry} className={styles.failRetryBtn}>Пройти ещё раз</button>
                <button type="button" onClick={() => { try { onSkip && onSkip(); } catch {} }} className={styles.failSkipBtn}>Пропустить</button>
              </div>
            </div>
          )}
        </div>
      </>
    );
  };
