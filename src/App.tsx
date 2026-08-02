import { Route, Routes } from "react-router-dom";
import PartyRoom from "./pages/PartyRoom";
import Host from "./pages/Host";
import Horn from "./pages/Horn";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PartyRoom />} />
      <Route path="/host" element={<Host />} />
      <Route path="/horn" element={<Horn />} />
    </Routes>
  );
}
