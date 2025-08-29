import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Trajectory from "./pages/Trajectory";
import LevelSelect from "./pages/LevelSelect";
import Tasks from "./pages/Tasks";
import My from "./pages/My";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
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
