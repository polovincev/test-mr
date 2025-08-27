import React from "react";
import styles from "./index.module.css";

interface LoaderOverlayProps {
  text?: string;
}

const LoaderOverlay: React.FC<LoaderOverlayProps> = ({ text }) => {
  return (
    <div className={styles.overlay}>
      <div className={styles.spinner}></div>
      {text ? <div className={styles.text}>{text}</div> : null}
    </div>
  );
};

export default LoaderOverlay;
