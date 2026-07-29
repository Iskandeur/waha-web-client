import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { COOKIE_NAME, gateEnabled, isValidToken, issueToken, pinMatches } from "../access-gate.js";

const LOGIN_PATHS = new Set(["/login", "/api/auth/login"]);

function readCookie(req: FastifyRequest, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

function setSessionCookie(reply: FastifyReply, token: string) {
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${30 * 24 * 60 * 60}`,
  ];
  if (process.env.NODE_ENV !== "development") attrs.push("Secure");
  reply.header("set-cookie", attrs.join("; "));
}

const LOGIN_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>WhatsApp# — demo access</title>
<style>
  body{font-family:system-ui,sans-serif;background:#111b21;color:#e9edef;display:flex;
    min-height:100vh;align-items:center;justify-content:center;margin:0}
  form{background:#202c33;padding:2rem;border-radius:12px;width:min(320px,90vw);
    box-shadow:0 10px 30px rgba(0,0,0,.4)}
  h1{font-size:1.1rem;margin:0 0 1rem}
  input{width:100%;box-sizing:border-box;padding:.6rem .8rem;border-radius:8px;border:1px solid #3b4a54;
    background:#2a3942;color:#e9edef;font-size:1rem;letter-spacing:.2em;text-align:center}
  button{width:100%;margin-top:.8rem;padding:.6rem;border:0;border-radius:8px;background:#00a884;
    color:#052e27;font-weight:600;font-size:1rem;cursor:pointer}
  p{color:#ff6b6b;font-size:.85rem;min-height:1.2em;margin:.6rem 0 0}
</style></head>
<body>
<form id="f">
  <h1>WhatsApp# demo — enter PIN</h1>
  <input id="pin" type="password" inputmode="numeric" autocomplete="off" autofocus maxlength="16">
  <button type="submit">Unlock</button>
  <p id="err"></p>
</form>
<script>
  document.getElementById("f").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pin = document.getElementById("pin").value;
    const err = document.getElementById("err");
    err.textContent = "";
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      location.href = "/";
    } else {
      err.textContent = "Wrong PIN.";
      document.getElementById("pin").value = "";
    }
  });
</script>
</body></html>`;

/** Gates every request behind a PIN when ACCESS_PIN is set. No-op (everything passes through)
 *  when the gate is disabled — self-hosted/local deployments don't need a PIN wall in front of
 *  their own instance. */
export async function accessRoutes(app: FastifyInstance) {
  if (!gateEnabled()) return;

  app.get("/login", async (_req, reply) => {
    reply.header("content-type", "text/html; charset=utf-8").send(LOGIN_PAGE);
  });

  app.post<{ Body: { pin?: unknown } }>("/api/auth/login", async (req, reply) => {
    const pin = req.body?.pin;
    if (typeof pin !== "string" || !pinMatches(pin)) {
      reply.code(401);
      return { error: "invalid_pin" };
    }
    setSessionCookie(reply, issueToken());
    return { ok: true };
  });

  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    if (LOGIN_PATHS.has(req.url) || req.url === "/api/health") return;
    const token = readCookie(req, COOKIE_NAME);
    if (isValidToken(token)) return;

    if (req.url.startsWith("/api/")) {
      reply.code(401).send({ error: "unauthorized" });
      return reply;
    }
    reply.redirect("/login");
    return reply;
  });
}
