import React, { useEffect, useRef, useState } from "react";
import styles from "./index.module.css";
import agent from "../../icon/ii.svg";
import { startSummaryChat, sendSummaryMessage, type SummaryMessage } from "../../services/api";

interface Props {
  open: boolean;
  onClose: () => void;
  chatId?: number;
}

const ChatModal: React.FC<Props> = ({ open, onClose, chatId }) => {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<SummaryMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const showTyping = loading;

  useEffect(() => {
    if (!open) return;
    if (typeof chatId === "number") {
      setLoading(true);
      startSummaryChat(chatId)
        .then((r) => setMessages(r.messages || []))
        .catch(() => setMessages([]))
        .finally(() => setLoading(false));
    } else {
      setMessages([]);
    }
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open, chatId]);

  useEffect(() => {
    try {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
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
      setMessages(r.messages || []);
    } catch {
      // keep optimistic message
    } finally {
      setLoading(false);
      inputRef.current?.focus();
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
          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 10, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div className={styles.bubble}>{m.content}</div>
            </div>
          ))}
          {showTyping && (
            <div style={{ marginBottom: 10, display: "flex", justifyContent: "flex-start" }}>
              <div className={`${styles.bubble} ${styles.typing}`}>
                <span className={styles.dots}>
                  <span className={styles.dot}></span>
                  <span className={styles.dot}></span>
                  <span className={styles.dot}></span>
                </span>
              </div>
            </div>
          )}
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
