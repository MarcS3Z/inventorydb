import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MsalProvider } from "@azure/msal-react";
import App from "./App.jsx";
import { AuthGate } from "./AuthGate.jsx";
import { authEnabled, initializeMsal, msalInstance } from "./authConfig.js";
import "./index.css";

const authDisabled =
  String(import.meta.env.VITE_AUTH_DISABLED || "").toLowerCase() === "true";

async function start() {
  const root = createRoot(document.getElementById("root"));

  if (authDisabled) {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
    return;
  }

  if (!authEnabled) {
    root.render(
      <StrictMode>
        <AuthGate enabled={false}>
          <App />
        </AuthGate>
      </StrictMode>
    );
    return;
  }

  await initializeMsal();
  root.render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <AuthGate enabled>
          <App />
        </AuthGate>
      </MsalProvider>
    </StrictMode>
  );
}

start();
