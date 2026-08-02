import { Route, Routes } from 'react-router-dom';
import PartyRoom from './pages/PartyRoom';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PartyRoom />} />
      {/* add more routes here, e.g.: */}
      {/* <Route path="/about" element={<About />} /> */}
    </Routes>
  );
}
