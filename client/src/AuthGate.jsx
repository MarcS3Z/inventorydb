import { useEffect, useState } from "react";
import {
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
  useMsal,
} from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "./authConfig.js";
import { setAccessTokenProvider } from "./api.js";

function LoginScreen() {
  const { instance, inProgress } = useMsal();
  const [error, setError] = useState(null);
  const busy = inProgress !== InteractionStatus.None;

  async function signIn() {
    setError(null);
    try {
      await instance.loginRedirect(loginRequest);
    } catch (err) {
      setError(err.message || "Sign-in failed");
    }
  }

  return (
    <div className="app home">
      <header className="header">
        <h1>InventoryDB</h1>
        <p>Sign in with your Microsoft work account to continue.</p>
      </header>
      {error && <div className="banner error">{error}</div>}
      <nav className="home-nav" aria-label="Sign in">
        <button type="button" onClick={signIn} disabled={busy}>
          {busy ? "Signing in…" : "Sign in with Microsoft"}
        </button>
      </nav>
    </div>
  );
}

function AuthenticatedApp({ children }) {
  const { instance, accounts } = useMsal();
  const account = instance.getActiveAccount() || accounts[0] || null;

  useEffect(() => {
    setAccessTokenProvider(async () => {
      if (!account) return null;
      try {
        const result = await instance.acquireTokenSilent({
          ...loginRequest,
          account,
        });
        return result.accessToken;
      } catch {
        await instance.acquireTokenRedirect(loginRequest);
        return null;
      }
    });

    return () => setAccessTokenProvider(async () => null);
  }, [account, instance]);

  return children;
}

function SetupRequired() {
  return (
    <div className="app home">
      <header className="header">
        <h1>InventoryDB</h1>
        <p>
          Microsoft SSO is not configured. Add{" "}
          <code>VITE_AZURE_CLIENT_ID</code> and{" "}
          <code>VITE_AZURE_TENANT_ID</code> to <code>client/.env</code>.
        </p>
      </header>
    </div>
  );
}

export function AuthGate({ enabled, children }) {
  if (!enabled) {
    return <SetupRequired />;
  }

  return (
    <>
      <AuthenticatedTemplate>
        <AuthenticatedApp>{children}</AuthenticatedApp>
      </AuthenticatedTemplate>
      <UnauthenticatedTemplate>
        <LoginScreen />
      </UnauthenticatedTemplate>
    </>
  );
}

export function useAuthUser() {
  const { instance, accounts } = useMsal();
  const account = instance.getActiveAccount() || accounts[0] || null;

  async function signOut() {
    await instance.logoutRedirect({
      account,
      postLogoutRedirectUri: window.location.origin,
    });
  }

  return {
    account,
    name: account?.name || account?.username || null,
    signOut,
  };
}
