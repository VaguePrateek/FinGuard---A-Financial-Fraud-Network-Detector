import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Anomalies from "./pages/Anomalies";
import Cycles from "./pages/Cycles";
import Network from "./pages/Network";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="anomalies" element={<Anomalies />} />
        <Route path="cycles" element={<Cycles />} />
        <Route path="network" element={<Network />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
