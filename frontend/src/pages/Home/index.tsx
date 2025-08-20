import { useState } from "react";
import { getMessage } from "../../services/api";
import styles from "./index.module.css";
import Header from "../../components/Header";

const Home = () => {
  const [message, setMessage] = useState<string>("");

  const handleClick = async () => {
    try {
      const data = await getMessage();
      setMessage(data.content);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      setMessage("Ошибка при получении сообщения");
    }
  };

  return (
    <div className={styles.home}>
      <Header />
      <div className={styles.main}>
        <div className={styles.inputContainer}>
          <textarea
            className={styles.textarea}
            rows={5}
            placeholder="Например, объясни, как решать квадратные уравнения"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                void handleClick();
              }
            }}
          />
          <button className={styles.sendButton} onClick={handleClick}>
            <img src={new URL("../../icon/arrow_up.svg", import.meta.url).href} alt="" className={styles.sendIcon} />
          </button>
        </div>
        <div className={styles.actionsContainer}>
          <div className={styles.actions}>
              <button className={styles.actionButton}>Рассказать о себе</button>
              <button className={styles.actionButton}>Как поставить цель моего обучения</button>
            </div>
        </div>
      </div>
      <div className={styles.contentContainer}>
          <h2>Продолжение контента</h2>
          <p>
            Здесь может быть любой контент страницы. Блок белый и немного заходит на
            основной фон сверху, а ниже доступен обычный скролл страницы.
          </p>
        </div>
    </div>
  );
};

export default Home;


