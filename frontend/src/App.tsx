import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Trajectory from "./pages/Trajectory";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/trajectory" element={<Trajectory />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
