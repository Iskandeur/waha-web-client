export const config = {
  wahaBaseUrl: process.env.WAHA_BASE_URL ?? "http://localhost:3000",
  wahaApiKey: process.env.WAHA_API_KEY ?? "",
  wahaSession: process.env.WAHA_SESSION ?? "default",
  port: Number(process.env.PORT ?? 8787),
  claudeBin: process.env.CLAUDE_BIN ?? "claude",
};
