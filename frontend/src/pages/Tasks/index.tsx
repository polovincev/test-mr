import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

const Tasks: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const chatIdParam = urlParams.get("chat_id");
  return (
    <div style={{ padding: 24 }}>
      <button
        onClick={() => navigate(`/trajectory${chatIdParam ? `?chat_id=${chatIdParam}` : ""}`)}
        style={{ marginBottom: 16, padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
      >
        ← Назад к траектории
      </button>
      <h1>Задачи</h1>
      <p>Страница в разработке.</p>
    </div>
  );
};

export default Tasks;
