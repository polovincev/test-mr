import React, { useEffect, useRef, useState } from "react";
import styles from "./index.module.css";
import agent from "../../icon/ii.svg";
import { startSummaryChat, sendSummaryMessage, type SummaryMessage } from "../../services/api";

interface Props {
  open: boolean;
  onClose: () => void;
  chatId?: number;
}

function cleanseText(text: string): string {
  return String(text || "").replace(/\[COMMAND:SUMMARY_DONE\]/gi, "").trim();
}

function formatMessageHtml(text: string): string {
  // Escape HTML first
  let s = cleanseText(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // Bold **text**
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // Italic *text* or _text_
  s = s.replace(/\*(?!\*)([^*]+)\*/g, "<em>$1</em>");
  s = s.replace(/_([^_]+)_/g, "<em>$1</em>");
  // Line breaks
  s = s.replace(/\n/g, "<br/>");
  return s;
}

const ChatModal: React.FC<Props> = ({ open, onClose, chatId }) => {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<SummaryMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const stickToBottomRef = useRef(true);

  const showTyping = loading;

  useEffect(() => {
    if (!open) return;
    // reset conversation and show typing while fetching first assistant message
    setMessages([]);
    stickToBottomRef.current = true; // start stuck to bottom
    if (typeof chatId === "number") {
      setLoading(true);
      startSummaryChat(chatId)
        .then((r) => setMessages((r.messages || []).map((m) => ({ ...m, content: cleanseText(m.content) }))))
        .catch(() => setMessages([]))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
      setMessages([]);
    }
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open, chatId]);

  // track whether user is near bottom; if scrolled up, pause autoscroll
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
      stickToBottomRef.current = nearBottom;
    };
    el.addEventListener("scroll", onScroll, { passive: true } as AddEventListenerOptions);
    return () => el.removeEventListener("scroll", onScroll as any);
  }, [listRef.current]);

  useEffect(() => {
    try {
      const el = listRef.current;
      if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
    } catch {}
  }, [messages.length, loading]);

  if (!open) return null;

  const send = async () => {
    const val = inputRef.current?.value?.trim() || "";
    if (!val || typeof chatId !== "number" || loading) return;
    setLoading(true);
    inputRef.current!.value = "";
    setMessages((m) => [...m, { role: "user", content: val }]);
    try {
      const r = await sendSummaryMessage(chatId, val);
      setMessages((r.messages || []).map((m) => ({ ...m, content: cleanseText(m.content) })));
    } catch {
      // keep optimistic message
    } finally {
      setLoading(false);
      inputRef.current?.focus();
      // After assistant reply, stick to bottom only if user was near bottom
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <span className={styles.avatar}>
              <img src={agent} alt="" />
            </span>
            ИИ‑помощник
          </div>
          <button className={styles.close} onClick={onClose}>
            ×
          </button>
        </div>
        <div className={styles.messages} ref={listRef}>
          <div className={styles.list}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div
                  className={`${styles.bubble} ${m.role === "user" ? styles.msgUser : styles.msgAssistant}`}
                  dangerouslySetInnerHTML={{ __html: formatMessageHtml(m.content) }}
                />
              </div>
            ))}
            {showTyping && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div className={`${styles.bubble} ${styles.msgAssistant} ${styles.typing}`}>
                  <span className={styles.dots}>
                    <span className={styles.dot}></span>
                    <span className={styles.dot}></span>
                    <span className={styles.dot}></span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className={styles.inputRow}>
          <textarea
            ref={inputRef}
            className={styles.textarea}
            placeholder="Напишите сообщение"
            rows={4}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button className={styles.sendButton} onClick={send} disabled={loading}>
            <img
              src={new URL("../../icon/arrow_up.svg", import.meta.url).href}
              alt=""
              className={styles.sendIcon}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatModal;
