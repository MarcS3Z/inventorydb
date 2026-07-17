import { LogLevel, PublicClientApplication } from "@azure/msal-browser";

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID || "";
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID || "";
const apiScope =
  import.meta.env.VITE_AZURE_API_SCOPE ||
  (clientId ? `api://${clientId}/access_as_user` : "");

export const authEnabled = Boolean(clientId && tenantId);

export const msalConfig = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
    },
  },
};

export const loginRequest = {
  scopes: apiScope ? [apiScope] : ["openid", "profile"],
};

export const msalInstance = authEnabled
  ? new PublicClientApplication(msalConfig)
  : null;

export async function initializeMsal() {
  if (!msalInstance) return null;
  await msalInstance.initialize();
  const result = await msalInstance.handleRedirectPromise();
  if (result?.account) {
    msalInstance.setActiveAccount(result.account);
  } else {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      msalInstance.setActiveAccount(accounts[0]);
    }
  }
  return msalInstance;
}
