import React, { useEffect, useRef } from "react";
import styles from "./index.module.css";
import agent from "../../icon/agent.svg";

interface Props {
  onClick?: () => void;
}

const AgentButton: React.FC<Props> = ({ onClick }) => {
  return (
    <button type="button" className={styles.btn} aria-label="AI" onClick={onClick}>
      <img src={agent} alt="agent" className={styles.icon} />
    </button>
  );
};

export default AgentButton;
