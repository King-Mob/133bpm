import { Route, Routes } from "react-router-dom";
import PartyRoom from "./pages/PartyRoom";
import Host from "./pages/Host";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PartyRoom />} />
      <Route path="/host" element={<Host />} />
    </Routes>
  );
}
