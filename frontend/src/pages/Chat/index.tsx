import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "./index.module.css";
import { Chat as ChatModel, createChat, sendMessage, getChat, listChats, ChatSummary } from "../../services/api";

const ACTIVE_ID_KEY = "activeChatId";

const Chat = () => {
  const [chat, setChat] = useState<ChatModel | null>(null);
  const [input, setInput] = useState("");
  const location = useLocation();
  const didInitRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isBootLoading, setIsBootLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        if (didInitRef.current) return; // prevent double-run in React StrictMode
        didInitRef.current = true;
        const state = location.state as { createNew?: boolean } | null;

        // Always load history first
        let history: ChatSummary[] = [];
        try {
          history = await listChats();
          setChats(history);
        } catch {
          history = [];
        } finally {
          setIsHistoryLoading(false);
        }

        if (state?.createNew) {
          // 1) Coming from Home: create new chat, then reload history and open it
          const created = await createChat("Новый чат");
          setChat(created);
          localStorage.setItem(ACTIVE_ID_KEY, String(created.id));
          setIsChatLoading(false);
          try {
            const updated = await listChats();
            setChats(updated);
          } catch { }
          // Clear consumed navigation state so refresh won't recreate
          window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
          return;
        }

        // 2) Page reload or direct open: open previously selected chat if present
        const savedIdRaw = localStorage.getItem(ACTIVE_ID_KEY);
        const savedId = savedIdRaw ? Number(savedIdRaw) : NaN;
        if (Number.isFinite(savedId)) {
          try {
            const existing = await getChat(savedId);
            setChat(existing);
            setIsChatLoading(false);
            return;
          } catch { }
        }

        // If nothing saved, but we have history, open the last one
        if (history.length > 0) {
          const latest = history[history.length - 1];
          try {
            const opened = await getChat(latest.id);
            setChat(opened);
            localStorage.setItem(ACTIVE_ID_KEY, String(opened.id));
            setIsChatLoading(false);
            return;
          } catch { }
        }

        // If still nothing, create the first chat
        const created = await createChat("Новый чат");
        setChat(created);
        localStorage.setItem(ACTIVE_ID_KEY, String(created.id));
        setIsChatLoading(false);
        try {
          const updated = await listChats();
          setChats(updated);
        } catch { }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      } finally {
        // keep boot loader until chat is opened/created; don't force-hide here
      }
    };
    void init();
  }, []);

  useEffect(() => {
    if (!isHistoryLoading && !isChatLoading && chat) {
      setIsBootLoading(false);
    }
  }, [isHistoryLoading, isChatLoading, chat]);

  const onSend = async () => {
    if (!chat || !input.trim() || isSending) return;
    const messageContent = input.trim();
    const optimistic: ChatModel = {
      ...chat,
      messages: [
        ...chat.messages,
        { role: "user", content: messageContent, timestamp: new Date().toISOString() },
      ],
    };
    setChat(optimistic);
    setInput("");
    try {
      setIsSending(true);
      const updated = await sendMessage(chat.id, messageContent, "user");
      setChat(updated);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      try {
        const fallback = await getChat(chat.id);
        setChat(fallback);
      } catch {
        // no-op
      }
    } finally {
      setIsSending(false);
    }
  };

  // Auto-scroll to the latest message when chat updates
  useEffect(() => {
    if (messagesEndRef.current) {
      try {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
      } catch {
        // no-op
      }
    }
  }, [chat?.messages.length]);

  const groupMessagesByDate = () => {
    if (!chat) return [] as { dateKey: string; label: string; items: ChatModel["messages"] }[];
    const groups = new Map<string, ChatModel["messages"]>();
    for (const m of chat.messages) {
      const dt = new Date(m.timestamp ?? new Date().toISOString());
      const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
      const arr = groups.get(key) ?? [];
      arr.push(m);
      groups.set(key, arr);
    }
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const monthRu = [
      "января",
      "февраля",
      "марта",
      "апреля",
      "мая",
      "июня",
      "июля",
      "августа",
      "сентября",
      "октября",
      "ноября",
      "декабря",
    ];
    const result: { dateKey: string; label: string; items: ChatModel["messages"] }[] = [];
    for (const [key, items] of Array.from(groups.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const [y, m, d] = key.split("-").map(Number);
      const label = key === todayKey ? "Сегодня" : `${d} ${monthRu[m]} ${y}`;
      result.push({ dateKey: key, label, items });
    }
    return result;
  };

  const activeId = chat?.id ?? null;
  const latestChat = chats.length > 0 ? [...chats].sort((a, b) => b.id - a.id)[0] : null;

  return (
    <div className={`${styles.rowFullHeight}`}>
      {isBootLoading && (
        <div className={styles.appLoaderOverlay}>
          <div className={styles.appBigSpinner}></div>
        </div>
      )}
      <div className={`${styles.leftPaneContainer}`}>
        <div className={styles.leftPane}>
          <div className={styles.leftHeader}>
            <img className={styles.leftHeaderLogo} src={new URL("../../icon/ii.svg", import.meta.url).href} alt="ИИ" />
            <span className={styles.leftHeaderTitle}>ИИ-помощник</span>
          </div>
          <div className={styles.chatListContainer}>
            {latestChat && (
              <>
                <div className={styles.chatList}>
                  <button
                    key={latestChat.id}
                    className={`${styles.chatItemBtn} ${activeId === latestChat.id ? styles.chatItemActive : ""}`}
                    onClick={async () => {
                      try {
                        setIsChatLoading(true);
                        setChat({ id: latestChat.id, title: latestChat.title, messages: [] });
                        localStorage.setItem(ACTIVE_ID_KEY, String(latestChat.id));
                        const opened = await getChat(latestChat.id);
                        setChat(opened);
                      } catch (e) {
                        // eslint-disable-next-line no-console
                        console.error(e);
                      } finally {
                        setIsChatLoading(false);
                      }
                    }}
                  >
                    {latestChat.title} #{latestChat.id}
                  </button>
                </div>
              </>
            )}
            <div className={styles.chatListTitle}>История</div>
            <div className={styles.chatList}>
              {chats
                .filter((c) => latestChat && c.id === latestChat.id ? false : true)
                .slice()
                .sort((a, b) => b.id - a.id) // newest first
                .map((c) => (
                  <button
                    key={c.id}
                    className={`${styles.chatItemBtn} ${activeId === c.id ? styles.chatItemActive : ""}`}
                    onClick={async () => {
                      try {
                        setIsChatLoading(true);
                        setChat({ id: c.id, title: c.title, messages: [] });
                        localStorage.setItem(ACTIVE_ID_KEY, String(c.id));
                        const opened = await getChat(c.id);
                        setChat(opened);
                      } catch (e) {
                        // eslint-disable-next-line no-console
                        console.error(e);
                      } finally {
                        setIsChatLoading(false);
                      }
                    }}
                  >
                    {c.title} #{c.id}
                  </button>
                ))}
            </div>
          </div>
        </div>
      </div>
      <div className={`${styles.rightPane}`}>
        <button className={styles.closeButton} aria-label="Закрыть" onClick={() => navigate("/")}>✕</button>
        <div className={`${styles.rightPaneContainer}`}>
          <div className={styles.messagesContainer}>
            {chat && (
              <div className={styles.messagesContainer}>
                <div className={styles.spacer} />
                <div className={styles.messagesInner}>
                  {isChatLoading ? (
                    <div className={styles.loadingContainer}>
                      <div className={styles.spinner}></div>
                    </div>
                  ) : (
                    <>
                      {groupMessagesByDate().map((group) => (
                        <div key={group.dateKey}>
                          <div className={styles.dateDivider}>{group.label}</div>
                          {group.items.map((m, idx) => (
                            <div key={`${group.dateKey}-${idx}`} className={`${styles.messageRow} ${m.role === "assistant" ? styles.leftRow : styles.rightRow}`}>
                              <div className={`${styles.message} ${m.role === "assistant" ? styles.assistant : styles.user}`}>
                                {m.content}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                      {isSending && (
                        <div className={`${styles.messageRow} ${styles.leftRow}`}>
                          <div className={`${styles.message} ${styles.assistant}`}>
                            <div className={styles.typing}>
                              <span className={styles.dot}></span>
                              <span className={styles.dot}></span>
                              <span className={styles.dot}></span>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            )}
          </div>
          <div className={styles.rightInner}>
            <div className={styles.chatInputContainer}>
              <textarea
                className={styles.chatInput}
                placeholder="Введите сообщение"
                rows={4}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void onSend();
                  }
                }}
              />
              <button className={styles.sendButton} onClick={() => void onSend()} disabled={isSending}>
                <img src={new URL("../../icon/arrow_up.svg", import.meta.url).href} alt="" className={styles.sendIcon} />
              </button>
            </div>
            <div className={styles.disclaimer}>Обрати внимание: ИИ-помощник может допускать ошибки</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;


