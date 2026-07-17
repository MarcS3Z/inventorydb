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

  const jwksUri = `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`;

  // Entra may issue v1 (sts.windows.net) or v2 (login.microsoftonline.com/.../v2.0)
  // access tokens depending on accessTokenAcceptedVersion. Use MCD multi-issuer mode —
  // the single `issuer` option only accepts a string (an array never matches).
  return auth({
    audience,
    tokenSigningAlg: "RS256",
    mcd: {
      issuers: [
        {
          issuer: `https://sts.windows.net/${tenantId}/`,
          jwksUri,
        },
        {
          issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
          jwksUri,
        },
      ],
    },
  });
}
