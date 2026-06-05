import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import BasicAuthGate from "./components/BasicAuthGate.jsx";
import AgentLayout from "./components/agents/AgentLayout.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import LeadsPage from "./pages/LeadsPage.jsx";
import AgentChatPage from "./pages/AgentChatPage.jsx";
import AgentRegistryPage from "./pages/AgentRegistryPage.jsx";
import ArtifactBrowserPage from "./pages/ArtifactBrowserPage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <BasicAuthGate>
        <Routes>
          <Route path="/agents" element={<AgentLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="chat" element={<AgentChatPage />} />
            <Route path="registry" element={<AgentRegistryPage />} />
            <Route path="artifacts" element={<ArtifactBrowserPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/agents" replace />} />
        </Routes>
      </BasicAuthGate>
    </BrowserRouter>
  );
}
