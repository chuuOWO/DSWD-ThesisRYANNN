import { createRoot } from "react-dom/client";
import App from "./app/App";
import { AuthProvider } from "./app/contexts/AuthContext";
import { ErrorBoundary } from "./app/components/ErrorBoundary";
import "./styles/index.css";

// Auto-recover if browser tries to load a stale JS chunk after a new deployment
window.addEventListener('vite:preloadError', (event) => {
  console.warn('[Vite] Stale build chunk detected. Reloading page to fetch latest version...', event);
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary fallbackTitle="Application Error">
    <AuthProvider>
      <App />
    </AuthProvider>
  </ErrorBoundary>
);

