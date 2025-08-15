import { useState } from "react";
import { getMessage } from "../services/api";

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
    <div style={{ padding: "2rem" }}>
      <button type="button" onClick={handleClick}>
        Получить сообщение
      </button>
      {message && <p>{message}</p>}
    </div>
  );
};

export default Home;
