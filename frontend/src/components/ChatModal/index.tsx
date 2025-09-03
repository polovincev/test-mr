import React, { useEffect, useRef } from "react";
import styles from "./index.module.css";
import agent from "../../icon/ii.svg";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ChatModal: React.FC<Props> = ({ open, onClose }) => {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  if (!open) return null;

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
        <div className={styles.messages} ref={listRef}></div>
        <div className={styles.inputRow}>
          <textarea
            ref={inputRef}
            className={styles.textarea}
            placeholder="Напишите сообщение"
            rows={4}
          />
          <button className={styles.sendButton}>
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
