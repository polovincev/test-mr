import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { authRegister } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./index.module.css";

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: Location } };
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== password2) {
      setError("Пароли не совпадают");
      return;
    }
    setLoading(true);
    try {
      const token = await authRegister(email.trim(), password);
      login(token);
      const redirect = localStorage.getItem("postLoginRedirect") || "/";
      localStorage.removeItem("postLoginRedirect");
      navigate(redirect);
    } catch (err) {
      setError((err as Error).message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h2 className={styles.title}>Регистрация</h2>
        {error && <div className={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <input className={styles.fullWidth} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className={styles.field}>
            <input className={styles.fullWidth} type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className={styles.field}>
            <input className={styles.fullWidth} type="password" placeholder="Повторите пароль" value={password2} onChange={(e) => setPassword2(e.target.value)} required />
          </div>
          <button className={styles.fullWidth} type="submit" disabled={loading}>
            {loading ? "Создаём..." : "Зарегистрироваться"}
          </button>
        </form>
        <div className={styles.doc}>
          Продолжая, вы принимаете <Link to="/terms" className={styles.docLink}>пользовательское соглашение</Link> и <Link to="/privacy" className={styles.docLink}>положение о конфиденциальности</Link>.
        </div>
        <div style={{ marginTop: 12 }}>
          Уже есть аккаунт? <Link to="/login" state={location.state}>Войти</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;


