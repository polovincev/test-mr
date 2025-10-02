import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { authLogin } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

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
    <div style={{maxWidth: 420, margin: "80px auto", padding: 24}}>
      <h2>Вход</h2>
      {error && <div style={{ color: "#b00020", marginBottom: 12 }}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <div style={{marginBottom: 12}}>
          <label style={{display: "block", marginBottom: 6}}>Email</label>
          <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required style={{width: "100%", padding: 8}} />
        </div>
        <div style={{marginBottom: 12}}>
          <label style={{display: "block", marginBottom: 6}}>Пароль</label>
          <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required style={{width: "100%", padding: 8}} />
        </div>
        <button type="submit" disabled={loading} style={{width: "100%", padding: 10}}>
          {loading ? "Входим..." : "Войти"}
        </button>
      </form>
      <div style={{marginTop: 12}}>
        Нет аккаунта? <Link to="/register" state={{ from: location }}>Зарегистрируйтесь</Link>
      </div>
    </div>
  );
};

export default Login;


