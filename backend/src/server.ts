import { config } from "./config.js";
import { assertSafeBind } from "./bind-guard.js";
import { buildApp } from "./app.js";

// Fail fast rather than silently start exposed — see bind-guard.ts.
assertSafeBind(config.host, config.accessPin);

const app = await buildApp();

app.listen({ port: config.port, host: config.host }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
