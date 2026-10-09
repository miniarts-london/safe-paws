/**
 * Two people, one board: Dr Karim moves Luna; Kaori (who sponsors Luna)
 * and Mona should each get their own message, and Karim none.
 * Start the server first (npm run dev:server).
 */
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import pg from "pg";
import WebSocket from "ws";
import { DEFAULT_BOARD_PORT, type BoardServerMessage } from "@safe-paws/shared/protocol";
import { createSessionToken, SESSION_COOKIE } from "@safe-paws/shared/session";

/**
 * Runs against its own throwaway database (`<your db>_smoke`) and its own
 * board server on another port, so your development data is never touched
 * and every run starts from the same sample data.
 */
const SMOKE_PORT = 8799;
const url = `ws://localhost:${SMOKE_PORT}`;
void DEFAULT_BOARD_PORT;

async function prepareDatabase() {
  const main = new URL(process.env.DATABASE_URL ?? "postgres://safepaws:safepaws@localhost:5432/safepaws");
  const smoke = new URL(main);
  smoke.pathname = `${main.pathname.slice(1)}_smoke`;
  const admin = new pg.Client({ connectionString: main.toString() });
  await admin.connect();
  const exists = await admin.query("select 1 from pg_database where datname = $1", [smoke.pathname.slice(1)]);
  if (!exists.rowCount) await admin.query(`create database "${smoke.pathname.slice(1)}"`);
  await admin.end();

  process.env.DATABASE_URL = smoke.toString();
  const { dropAll, seed } = await import("@safe-paws/db/seed");
  const { migrate } = await import("@safe-paws/db/migrate");
  const { insertUpload, closePool } = await import("@safe-paws/db");
  await dropAll();
  await migrate(() => {});
  await seed(() => {});
  // A real upload row, so attaching it to an animal passes the foreign key.
  await insertUpload({ id: "smoke-photo-0001", kind: "photo", mimeType: "image/jpeg", name: "luna.jpg", sizeBytes: 1, uploadedBy: "mona" });
  await closePool();
  return smoke.toString();
}

async function startServer(databaseUrl: string): Promise<ChildProcess> {
  const child = spawn(process.execPath, ["--import", "tsx", path.join(__dirname, "..", "src", "index.ts")], {
    env: { ...process.env, DATABASE_URL: databaseUrl, BOARD_PORT: String(SMOKE_PORT) },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await new Promise<void>((resolve, reject) => {
    child.stdout!.on("data", (d) => String(d).includes("board server on") && resolve());
    child.on("exit", (code) => reject(new Error(`Board server exited with code ${code}`)));
  });
  return child;
}

const ORIGIN = "http://localhost:3000";

/** Signs a session the same way the login page does, then connects with it as a browser would. */
function connect(userId: string) {
  const { token } = createSessionToken(userId);
  const ws = new WebSocket(url, { headers: { Cookie: `${SESSION_COOKIE}=${token}` }, origin: ORIGIN });
  const inbox: BoardServerMessage[] = [];
  ws.on("message", (raw) => inbox.push(JSON.parse(raw.toString())));
  const ready = new Promise<void>((resolve) => ws.on("open", () => resolve()));
  return { ws, inbox, ready };
}

/** Resolves with the HTTP status the server refused the handshake with (or "opened"). */
function attempt(headers: Record<string, string>, origin: string, protocols: string[] = []) {
  return new Promise<string>((resolve) => {
    const ws = new WebSocket(url, protocols, { headers, origin });
    ws.on("open", () => (ws.close(), resolve("opened")));
    ws.on("unexpected-response", (_req, res) => resolve(String(res.statusCode)));
    ws.on("error", () => {});
  });
}

async function main() {
  const server = await startServer(await prepareDatabase());
  try {
    await scenario();
  } finally {
    server.kill();
  }
}

async function scenario() {
  // Security checks first: no cookie, a forged cookie, and a valid cookie from another website.
  const forged = createSessionToken("kaori").token.replace(/.$/, (c) => (c === "A" ? "B" : "A"));
  const checks = {
    "no cookie": await attempt({}, ORIGIN),
    "forged cookie": await attempt({ Cookie: `${SESSION_COOKIE}=${forged}` }, ORIGIN),
    "other website": await attempt({ Cookie: `${SESSION_COOKIE}=${createSessionToken("kaori").token}` }, "https://evil.example"),
    "app, forged token": await attempt({ Authorization: `Bearer ${forged}` }, ""),
    "app, valid token": await attempt({ Authorization: `Bearer ${createSessionToken("kaori").token}` }, ""),
    "app, token as subprotocol": await attempt({}, "http://localhost:8081", [
      "safe-paws",
      `bearer.${createSessionToken("kaori").token}`,
    ]),
  };
  console.log("handshakes:", checks);
  const refusedOk =
    checks["no cookie"] === "401" &&
    checks["forged cookie"] === "401" &&
    checks["other website"] === "403" &&
    checks["app, forged token"] === "401" &&
    checks["app, valid token"] === "opened" &&
    checks["app, token as subprotocol"] === "opened";

  const people = Object.fromEntries(["karim", "kaori", "mona", "sara"].map((id) => [id, connect(id)]));
  await Promise.all(Object.values(people).map((p) => p.ready));
  await new Promise((r) => setTimeout(r, 300));

  const send = (who: string, msg: object) => people[who].ws.send(JSON.stringify(msg));
  send("karim", { type: "animal.move", animalId: "luna", toStage: "ready", toIndex: 0 });
  send("sara", { type: "animal.note", animalId: "bobby", text: "Bobby met a cat today and ignored it completely." });
  const max = {
    name: "Max", species: "dog", sex: "male", age: { value: 6, unit: "months", estimated: true },
    neutered: "unknown", weightKg: 8.4, area: "Smouha", about: "Found under a car, very hungry.", media: [],
  };
  send("sara", { type: "animal.create", animalId: "smoke-max-0001", details: max });
  send("sara", { type: "animal.create", animalId: "smoke-bad-0001", details: { ...max, name: "" } }); // refused
  send("mona", {
    type: "animal.update", animalId: "luna",
    details: {
      name: "Luna", species: "dog", sex: "female", age: { value: 2, unit: "years", estimated: true },
      neutered: "no", weightKg: 15.1, area: "Sidi Gaber", about: "Gentle, loves a chin scratch.",
      media: [{ id: "smoke-photo-0001", kind: "photo", name: "luna.jpg" }],
    },
  });
  await new Promise((r) => setTimeout(r, 500));

  let failed = !refusedOk;
  const saraErrors = people.sara.inbox.filter((m) => m.type === "error").map((m) => (m.type === "error" ? m.message : ""));
  console.log("sara's refused registration:", saraErrors);
  if (!saraErrors.includes("Give them a name.")) failed = true;
  for (const [id, p] of Object.entries(people)) {
    const notes = p.inbox.filter((m) => m.type === "notification").map((m) => (m.type === "notification" ? m.notification.text : ""));
    const patches = p.inbox.filter((m) => m.type === "board.patch").length;
    console.log(`${id.padEnd(6)} patches=${patches}  notifications=${notes.length}`);
    for (const t of notes) console.log(`         · ${t}`);
    if (patches !== 4) failed = true; // move, note, new animal, Luna's details
  }
  if (people.karim.inbox.some((m) => m.type === "notification" && m.notification.actorId === "karim")) failed = true;

  if (!(await members(people))) failed = true;

  for (const p of Object.values(people)) p.ws.close();
  process.exitCode = failed ? 1 : 0;
  console.log(failed ? "FAILED" : "OK");
}

/**
 * Aya signs up on the website after the server started (inserted straight into
 * Postgres here). She can look and follow but not change anything, until Mona
 * makes her staff. Karim, who isn't a coordinator, can't.
 */
async function members(people: Record<string, ReturnType<typeof connect>>) {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query(
    "insert into users (id, name, role, title, email, password_hash) values ('smoke-aya', 'Aya', 'member', 'Driver, Smouha', 'aya@example.com', 'x')",
  );
  await db.end();

  const aya = connect("smoke-aya");
  await aya.ready;
  await new Promise((r) => setTimeout(r, 300));
  const sendAs = (p: ReturnType<typeof connect>, msg: object) => p.ws.send(JSON.stringify(msg));
  const errors = (p: ReturnType<typeof connect>) => p.inbox.flatMap((m) => (m.type === "error" ? [m.message] : []));
  const lastMembers = (p: ReturnType<typeof connect>) => p.inbox.flatMap((m) => (m.type === "members" ? [m.members] : [])).at(-1);

  const welcomed = aya.inbox.some((m) => m.type === "welcome");
  const introduced = people.kaori.inbox.some((m) => m.type === "user.upsert" && m.user.id === "smoke-aya");
  const monaSees = lastMembers(people.mona)?.some((m) => m.id === "smoke-aya" && m.reviewedAt === null) ?? false;
  const kaoriSeesNoList = !people.kaori.inbox.some((m) => m.type === "members");

  sendAs(aya, { type: "animal.move", animalId: "zeina", toStage: "adopted", toIndex: 0 });
  sendAs(aya, { type: "animal.follow", animalId: "zeina", follow: true });
  sendAs(people.karim, { type: "member.approve", userId: "smoke-aya", role: "vet", title: "Vet" });
  await new Promise((r) => setTimeout(r, 400));
  const refusedMove = errors(aya).some((e) => e.startsWith("Members can view the board"));
  const followed = aya.inbox.some((m) => m.type === "board.patch" && m.patch.animals.some((a) => a.id === "zeina" && a.followers.includes("smoke-aya")));
  const zeinaStayed = !aya.inbox.some((m) => m.type === "board.patch" && m.patch.columns.adopted?.includes("zeina"));
  const karimRefused = errors(people.karim).includes("Only coordinators can review new members.");

  sendAs(people.mona, { type: "member.approve", userId: "smoke-aya", role: "fosterer", title: "Foster carer, Smouha" });
  await new Promise((r) => setTimeout(r, 400));
  const promoted = aya.inbox.some((m) => m.type === "user.upsert" && m.user.id === "smoke-aya" && m.user.role === "fosterer");
  const listCleared = !(lastMembers(people.mona)?.some((m) => m.id === "smoke-aya") ?? true);
  sendAs(aya, { type: "animal.note", animalId: "zeina", text: "Drove Zeina to her meet-and-greet." });
  await new Promise((r) => setTimeout(r, 400));
  const canPost = aya.inbox.some((m) => m.type === "board.patch" && m.patch.animals.some((a) => a.notes.some((n) => n.authorId === "smoke-aya")));
  aya.ws.close();

  const result = { welcomed, introduced, monaSees, kaoriSeesNoList, refusedMove, followed, zeinaStayed, karimRefused, promoted, listCleared, canPost };
  console.log("members:", result);
  return Object.values(result).every(Boolean);
}

void main();
