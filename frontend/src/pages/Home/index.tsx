import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMessage, getFact } from "../../services/api";
import styles from "./index.module.css";
import Header from "../../components/Header";

const Home = () => {
  const [message, setMessage] = useState<string>("");
  const [fact, setFact] = useState<string>("");
  const [isFactLoading, setIsFactLoading] = useState<boolean>(false);
  const navigate = useNavigate();

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

  const handleGetFact = async () => {
    try {
      setIsFactLoading(true);
      const data = await getFact();
      setFact(data.content);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    } finally {
      setIsFactLoading(false);
    }
  };

  useEffect(() => {
    // Ignore any previously saved active chat to force new chat creation
    localStorage.removeItem("activeChatId");
  }, []);

  return (
    <>
      <div className={styles.home}>
        <Header />
        <div className="container flex-grow-1 d-flex flex-column justify-content-center">
          <div className="row justify-content-center">
            <div className="col-12 col-lg-8 mx-auto">
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
                <button className={styles.sendButton} onClick={() => navigate("/chat", { state: { createNew: true } })}>
                  <img src={new URL("../../icon/arrow_up.svg", import.meta.url).href} alt="" className={styles.sendIcon} />
                </button>
              </div>
            </div>
            <div className="col-12 col-lg-8 mx-auto">
              <div className={styles.actionsContainer}>
                <div className={styles.actions}>
                  <button className={styles.actionButton} onClick={() => navigate("/trajectory")}>Траектория</button>
                  <button className={styles.actionButton} onClick={() => navigate("/chat", { state: { createNew: true } })}>Рассказать о себе</button>
                  <button className={styles.actionButton} onClick={() => navigate("/chat", { state: { createNew: true } })}>Как поставить цель моего обучения</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={`${styles.contentContainerFluid}`}>
        <div className={`${styles.contentContainer}`}>
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-12 col-lg-8">
                <div className={styles.contentBlock}>
                  <div className={styles.contentTitle}>Твоя цель</div>
                  <div className={styles.contentBlockDescription}>Давай поставим цель, и будем отслеживать прогресс, чтобы видеть, насколько ты приблизился к желаемому результату</div>
                  <button className={styles.setGoalButton} onClick={() => navigate("/chat", { state: { createNew: true } })}>Поставить</button>
                  <img src={new URL("../../icon/goal.png", import.meta.url).href} alt="Goal" className={styles.goalImage} />
                </div>
              </div>
              <div className="col-12 col-lg-4">
                <div className={`${styles.contentBlock} ${styles.factBlock}`}>
                  <div className={styles.factBadge}>Факт дня</div>
                  {fact && (
                    <div className={styles.factContent}>{fact}</div>
                  )}
                  {!fact && (
                    <div className={styles.factTitle}>
                      Каждый день новое знание.
                      <br />
                      То, о чём не расскажут на уроках
                    </div>
                  )}
                  {!fact && (
                    <button className={`${styles.factButton} ${isFactLoading ? styles.loading : ""}`} onClick={handleGetFact} disabled={isFactLoading}>
                      {isFactLoading ? "Загрузка..." : "Узнать"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;