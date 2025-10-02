import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { authLogin } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./index.module.css";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const token = await authLogin(email.trim(), password);
      login(token);
      const redirect = localStorage.getItem("postLoginRedirect") || "/";
      localStorage.removeItem("postLoginRedirect");
      navigate(redirect);
    } catch (err) {
      setError((err as Error).message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h2 className={styles.title}>Войдите в учётную запись</h2>
        {error && <div className={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <input
              className={styles.fullWidth}
              type="email"
              value={email}
              placeholder="Email"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <input
              className={styles.fullWidth}
              type="password"
              value={password}
              placeholder="Пароль"
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className={styles.fullWidth} type="submit" disabled={loading}>
            {loading ? "Входим..." : "Войти"}
          </button>
        </form>
        <div className={styles.doc}>
          Продолжая, вы принимаете <Link to="/terms" className={styles.docLink}>пользовательское соглашение</Link> и <Link to="/privacy" className={styles.docLink}>положение о конфиденциальности</Link>.
        </div>
        <div className={styles.registerLink}>
          Нет аккаунта?{" "}
          <Link to="/register" state={{ from: location }}>
            Зарегистрируйтесь
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
