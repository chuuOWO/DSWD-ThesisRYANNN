import { createRoot } from "react-dom/client";
import App from "./app/App";
import { AuthProvider } from "./app/contexts/AuthContext";
import { ErrorBoundary } from "./app/components/ErrorBoundary";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary fallbackTitle="Application Error">
    <AuthProvider>
      <App />
    </AuthProvider>
  </ErrorBoundary>
);
