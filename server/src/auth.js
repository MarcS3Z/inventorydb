import { auth } from "express-oauth2-jwt-bearer";

function envFlag(name) {
  return String(process.env[name] || "").toLowerCase() === "true";
}

export function isAuthDisabled() {
  return envFlag("AUTH_DISABLED");
}

export function createRequireAuth() {
  if (isAuthDisabled()) {
    return (_req, _res, next) => next();
  }

  const tenantId = process.env.AZURE_TENANT_ID;
  const audience = process.env.AZURE_AUDIENCE || process.env.AZURE_CLIENT_ID;

  if (!tenantId || !audience) {
    return (_req, res) => {
      res.status(503).json({
        error:
          "Authentication is not configured. Set AZURE_TENANT_ID and AZURE_AUDIENCE (or AZURE_CLIENT_ID), or set AUTH_DISABLED=true for local development.",
      });
    };
  }

  return auth({
    audience,
    issuerBaseURL: `https://login.microsoftonline.com/${tenantId}/v2.0`,
    tokenSigningAlg: "RS256",
  });
}
