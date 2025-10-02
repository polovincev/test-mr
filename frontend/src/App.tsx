import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Trajectory from "./pages/Trajectory";
import LevelSelect from "./pages/LevelSelect";
import Tasks from "./pages/Tasks";
import My from "./pages/My";
import AdminPrompts from "./pages/AdminPrompts";
import AdminStats from "./pages/AdminStats";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { useAuth } from "./contexts/AuthContext";

function App() {
  const { token } = useAuth();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* secret-ish admin path */}
        <Route path="/__internal__/manage/prompts" element={<AdminPrompts />} />
        <Route path="/__internal__/stats" element={<AdminStats />} />
        <Route path="/login" element={token ? <Navigate to="/" /> : <Login />} />
        <Route path="/register" element={token ? <Navigate to="/" /> : <Register />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/trajectory" element={<Trajectory />} />
        <Route path="/level-select" element={<LevelSelect />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/my" element={<My />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
