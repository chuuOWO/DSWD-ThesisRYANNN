
  import { createRoot } from "react-dom/client";
<<<<<<< Updated upstream
  import App from "./app/App.tsx";
=======
  import App from "./app/App";
  import { AuthProvider } from "./app/contexts/AuthContext";
>>>>>>> Stashed changes
  import "./styles/index.css";

  createRoot(document.getElementById("root")!).render(<App />);
  