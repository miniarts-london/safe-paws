// Runs `next` with the repo root's .env.local loaded first, so the web app and the board
// server share one settings file. (Loading it from next.config.ts isn't enough: Next resets
// its environment while starting up, so keys added there never reached the API routes.)
// Values already set in the shell win over the file. On Vercel there's no file and the
// dashboard's environment variables are used as normal.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");
for (const file of [".env.local", ".env"]) {
  const p = path.join(root, file);
  if (existsSync(p)) process.loadEnvFile(p);
}

const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
const child = spawn(process.execPath, [next, ...process.argv.slice(2)], { stdio: "inherit" });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code, signal) => (signal ? process.kill(process.pid, signal) : process.exit(code ?? 0)));
