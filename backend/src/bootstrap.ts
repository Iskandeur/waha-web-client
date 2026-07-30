import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./env-file.js";

// Runs before `config.js` (imported inside server.js) reads `process.env` — a plain top-level
// `import "./server.js"` above `loadEnvFile()` would be evaluated first regardless of statement
// order (ESM hoists imports), so this has to be a *dynamic* import, sequenced after the call.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
loadEnvFile(path.join(repoRoot, ".env"));

await import("./server.js");
