import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import { LiveProvider } from "./lib/live";
import { Layout } from "./components/Layout";
import { Overview } from "./pages/Overview";
import { Scanner } from "./pages/Scanner";
import { Markets } from "./pages/Markets";
import { Opportunities } from "./pages/Opportunities";
import { Analysis } from "./pages/Analysis";
import { Operations } from "./pages/Operations";
import { History } from "./pages/History";
import { Stats } from "./pages/Stats";
import { Settings } from "./pages/Settings";
import { Capture } from "./pages/Capture";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LiveProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="scanner" element={<Scanner />} />
            <Route path="mercados" element={<Markets />} />
            <Route path="oportunidades" element={<Opportunities />} />
            <Route path="analise/:key" element={<Analysis />} />
            <Route path="operacoes" element={<Operations />} />
            <Route path="historico" element={<History />} />
            <Route path="estatisticas" element={<Stats />} />
            <Route path="configuracoes" element={<Settings />} />
            <Route path="captura" element={<Capture />} />
            <Route path="*" element={<Overview />} />
          </Route>
        </Routes>
      </HashRouter>
    </LiveProvider>
  </StrictMode>,
);
