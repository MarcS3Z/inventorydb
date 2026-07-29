export function getRequestUserName(req) {
  const payload = req.auth?.payload ?? req.auth ?? {};
  return (
    payload.name ||
    payload.preferred_username ||
    payload.upn ||
    payload.unique_name ||
    payload.email ||
    "Unknown user"
  );
}

export async function writeInventoryLog(prisma, { userName, assetId, message }) {
  if (!assetId || !message) return;

  await prisma.log.create({
    data: {
      userName: userName || "Unknown user",
      assetId: String(assetId),
      message: String(message),
    },
  });
}
