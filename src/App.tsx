import { Route, Routes } from "react-router-dom";
import Guest from "./pages/Guest";
import Host from "./pages/Host";
import Horn from "./pages/Horn";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Guest />} />
      <Route path="/host" element={<Host />} />
      <Route path="/horn" element={<Horn />} />
    </Routes>
  );
}
