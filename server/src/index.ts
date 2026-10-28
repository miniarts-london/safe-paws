import { createServer, type IncomingMessage } from "node:http";
import { closePool } from "@safe-paws/db";
import { migrate } from "@safe-paws/db/migrate";
import { WebSocketServer, type WebSocket } from "ws";
import {
  CLOSE_SESSION_ENDED,
  DEFAULT_BOARD_PORT,
  type BoardClientMessage,
  type Animal,
  type Board,
  type BoardPatch,
  type BoardServerMessage,
  type Notification,
  type StageId,
  type User,
  isStaff,
  ROLE_LABELS,
} from "@safe-paws/shared/protocol";
import { readCookie, SESSION_COOKIE, verifySessionToken, type Session } from "@safe-paws/shared/session";
import { animalDetailsSchema, approveSchema, profileSchema, requestSchema } from "@safe-paws/shared/schemas";
import { notifyCreate, notifyMove, notifyNote, notifyRequest, notifyUpdate } from "./notify";
import { registerPushToken, sendPush, unregisterPushToken } from "./push";
import {
  BoardError,
  addNote,
  approve,
  ensureUser,
  keep,
  membersList,
  createAnimal,
  createNotifications,
  findUser,
  getBoard,
  getUsers,
  loadState,
  markRead,
  moveAnimal,
  notificationsFor,
  requestAnimal,
  setFollow,
  setLiked,
  updateAnimal,
  removeAnimal,
  saveProfile,
} from "./state";

// Hosts such as Render, Railway and Fly tell the server which port to use in PORT.
const port = Number(process.env.BOARD_PORT ?? process.env.PORT ?? DEFAULT_BOARD_PORT);

/**
 * Pages allowed to open a board connection from a browser. Without this check
 * another website could open a socket as whoever is signed in (cross-site
 * WebSocket hijacking). Trailing slashes are ignored, since browsers never send one.
 */
const allowedOrigins = new Set(
  (process.env.BOARD_ALLOWED_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean),
);

type AuthedRequest = IncomingMessage & { session?: Session; client?: ClientKind };

type ClientKind = "web" | "app";

/**
 * Subprotocols. Both send their token alongside as `bearer.<token>`:
 * - the mobile app asks for `safe-paws`;
 * - the website asks for `safe-paws-web`. When the board server is on another
 *   domain (Vercel + Railway), the browser won't send the website's cookie,
 *   so the page fetches its token from /api/session/socket-token instead.
 * A cookie still works when both are on one domain (local development).
 */
const APP_PROTOCOL = "safe-paws";
const WEB_PROTOCOL = "safe-paws-web";

const requestedProtocols = (req: IncomingMessage) =>
  (req.headers["sec-websocket-protocol"] ?? "").split(",").map((p) => p.trim());

/**
 * The app's token, from an Authorization header (native) or a `bearer.<token>`
 * subprotocol (browsers can't set headers on a WebSocket, so the app's web
 * preview uses this; native uses it too, so there's one code path).
 */
function bearerToken(req: IncomingMessage) {
  const fromHeader = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (fromHeader) return fromHeader;
  return requestedProtocols(req).find((p) => p.startsWith("bearer."))?.slice("bearer.".length);
}

// Attached to an HTTP server below, which starts listening only once the board has loaded.
const wss = new WebSocketServer({
  noServer: true,
  maxPayload: 64 * 1024,
  // Agree on the app or web protocol, never echo the token back.
  handleProtocols: (protocols) => (protocols.has(WEB_PROTOCOL) ? WEB_PROTOCOL : protocols.has(APP_PROTOCOL) ? APP_PROTOCOL : false),
  verifyClient: ({ req, origin }: { req: AuthedRequest; origin: string }, done) => {
    // A token (app, or website on another domain), else the website's cookie.
    const bearer = bearerToken(req);
    const fromWebsite = requestedProtocols(req).includes(WEB_PROTOCOL);
    let client: ClientKind = fromWebsite ? "web" : "app";
    let session = bearer ? verifySessionToken(bearer) : null;
    // A page can only get a token from our own website, but check where it's running anyway.
    if (bearer && fromWebsite && !allowedOrigins.has(origin)) return done(false, 403, "Origin not allowed");
    if (!bearer) {
      // Browsers: cookies ride along on handshakes from any site, so the page must be one of ours.
      if (!allowedOrigins.has(origin)) return done(false, 403, "Origin not allowed");
      session = verifySessionToken(readCookie(req.headers.cookie, SESSION_COOKIE));
      client = "web";
    }
    if (!session) return done(false, 401, "Sign in first");
    const s = session;
    // Someone who signed up after the server started is looked up in Postgres.
    ensureUser(s.uid)
      .then((found) => {
        if (!found) return done(false, 401, "Sign in first");
        req.session = s;
        req.client = client;
        if (found.isNew) introduce(found.user);
        done(true);
      })
      .catch((err) => {
        console.error(err);
        done(false, 503, "Couldn't check your account");
      });
  },
});

type Client = WebSocket & { userId: string; kind: ClientKind; isAlive?: boolean };

/**
 * userId → open sockets. One person can have several tabs or devices,
 * and each of them should get that person's notifications.
 */
const sockets = new Map<string, Set<Client>>();

function send(ws: WebSocket, msg: BoardServerMessage) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}
function sendToUser(userId: string, msg: BoardServerMessage) {
  for (const ws of sockets.get(userId) ?? []) send(ws, msg);
}
/**
 * Delivers a notification live to every open connection, and as a push to
 * the person's phone when the app isn't open (an open app keeps a socket).
 */
function deliver(n: Notification) {
  sendToUser(n.userId, { type: "notification", notification: n });
  const appOpen = [...(sockets.get(n.userId) ?? [])].some((ws) => ws.kind === "app");
  if (!appOpen) void sendPush(n);
}
function broadcast(msg: BoardServerMessage) {
  for (const ws of wss.clients) send(ws, msg);
}

/**
 * Offers to adopt or sponsor carry people's messages, often with a phone
 * number, so only staff receive everyone's, and only coordinators (who get in
 * touch) receive their emails. Members get just their own.
 */
function forViewer(animal: Animal, userId: string): Animal {
  const role = findUser(userId)?.role;
  if (role === "coordinator" || animal.requests.length === 0) return animal;
  if (isStaff(role)) return { ...animal, requests: animal.requests.map(({ email: _email, ...r }) => r) };
  return { ...animal, requests: animal.requests.filter((r) => r.userId === userId) };
}
const boardFor = (board: Board, userId: string): Board => ({
  ...board,
  animals: Object.fromEntries(Object.entries(board.animals).map(([id, a]) => [id, forViewer(a, userId)])),
});

/** A board change for everyone, each person getting their own view of it. */
function broadcastPatch(patch: BoardPatch) {
  for (const ws of wss.clients as Set<Client>) {
    send(ws, { type: "board.patch", patch: { ...patch, animals: patch.animals.map((a) => forViewer(a, ws.userId)) } });
  }
}

/** Coordinators keep a live list of who signed up. */
async function sendMembers(to: "coordinators" | Client) {
  const msg: BoardServerMessage = { type: "members", members: await membersList() };
  if (to !== "coordinators") return send(to, msg);
  for (const u of getUsers()) if (u.role === "coordinator") sendToUser(u.id, msg);
}

/** Someone new (or newly changed): everyone needs their name, coordinators need the review list. */
function introduce(user: User) {
  broadcast({ type: "user.upsert", user });
  void sendMembers("coordinators").catch(console.error);
}

/** Members can look and follow; changing the board is for staff. */
const STAFF_ONLY = new Set<BoardClientMessage["type"]>(["animal.move", "animal.note", "animal.create", "animal.update"]);
const COORDINATOR_ONLY = new Set<BoardClientMessage["type"]>(["member.approve", "member.keep", "animal.delete"]);

/**
 * Changes run one at a time, in arrival order. Each one reads the board,
 * writes to Postgres and then updates memory; letting two interleave (say,
 * two people dragging cards in the same column) could save a stale order.
 */
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function handle(ws: Client, msg: BoardClientMessage) {
  const actor = findUser(ws.userId)!;
  const users = getUsers();

  // Checked on every message against the current role, so a change takes effect at once.
  if (STAFF_ONLY.has(msg.type) && !isStaff(actor.role)) {
    throw new BoardError("Members can view the board. Ask a coordinator for staff access to make changes.");
  }
  if (COORDINATOR_ONLY.has(msg.type) && actor.role !== "coordinator") {
    throw new BoardError("Only coordinators can review new members.");
  }

  switch (msg.type) {
    case "animal.move": {
      const { from, animal, patch } = await moveAnimal(msg.animalId, msg.toStage as StageId, msg.toIndex, actor.id);
      broadcastPatch(patch);
      (await createNotifications(notifyMove(animal, from, actor, users), "moved", animal.id, actor.id)).forEach(deliver);
      return;
    }
    case "animal.note": {
      const { animal, text, patch } = await addNote(msg.animalId, msg.text, actor.id);
      broadcastPatch(patch);
      (await createNotifications(notifyNote(animal, text, actor, users), "note", animal.id, actor.id)).forEach(deliver);
      return;
    }
    case "animal.create":
    case "animal.update": {
      // Same rules as the form; the server never trusts that the browser already checked.
      const parsed = animalDetailsSchema.safeParse(msg.details);
      if (!parsed.success) throw new BoardError(parsed.error.issues[0]?.message ?? "Check the animal's details.");
      if (msg.type === "animal.create") {
        const { animal, patch } = await createAnimal(msg.animalId, parsed.data, actor.id);
        broadcastPatch(patch);
        (await createNotifications(notifyCreate(animal, actor, users), "registered", animal.id, actor.id)).forEach(deliver);
      } else {
        const { animal, patch, addedPhotos, addedVideos } = await updateAnimal(msg.animalId, parsed.data, actor.id);
        broadcastPatch(patch);
        (await createNotifications(notifyUpdate(animal, actor, users, addedPhotos, addedVideos), "details", animal.id, actor.id)).forEach(deliver);
      }
      return;
    }
    case "animal.delete":
      broadcastPatch((await removeAnimal(msg.animalId)).patch);
      return;
    case "animal.follow":
      broadcastPatch(await setFollow(msg.animalId, actor.id, msg.follow));
      return;
    case "animal.like":
      broadcastPatch(await setLiked(msg.animalId, actor.id, msg.like === true));
      return;
    case "animal.request": {
      const parsed = requestSchema.safeParse(msg);
      if (!parsed.success) throw new BoardError(parsed.error.issues[0]?.message ?? "Check your request.");
      const { kind, message } = parsed.data;
      const { animal, patch } = await requestAnimal(msg.animalId, actor.id, kind, message);
      broadcastPatch(patch);
      (await createNotifications(notifyRequest(animal, actor, kind, message, users), "request", animal.id, actor.id)).forEach(deliver);
      return;
    }
    case "push.register":
      if (!(await registerPushToken(actor.id, msg.token))) throw new BoardError("That doesn't look like a push token.");
      return;
    case "push.unregister":
      await unregisterPushToken(actor.id, msg.token);
      return;
    case "member.approve": {
      const parsed = approveSchema.safeParse(msg);
      if (!parsed.success) throw new BoardError(parsed.error.issues[0]?.message ?? "Check the role and title.");
      const { userId, role, title } = parsed.data;
      introduce(await approve(userId, role, title, actor.id));
      // Now staff, they can see everyone's offers: send them the full board.
      for (const ws of sockets.get(userId) ?? []) {
        notificationsFor(userId)
          .then((notifications) => send(ws, { type: "welcome", userId, users: getUsers(), board: getBoard(), notifications }))
          .catch(console.error);
      }
      return;
    }
    case "profile.update": {
      const parsed = profileSchema.safeParse(msg);
      if (!parsed.success) throw new BoardError(parsed.error.issues[0]?.message ?? "Check your name.");
      // Left empty: what they do, e.g. "Vet".
      const title = parsed.data.title || ROLE_LABELS[actor.role];
      introduce(await saveProfile(actor.id, parsed.data.name, title));
      return;
    }
    case "member.keep":
      await keep(msg.userId, actor.id);
      await sendMembers("coordinators");
      return;
    case "notifications.read":
      await markRead(actor.id, msg.ids);
      sendToUser(actor.id, { type: "notifications.read", ids: msg.ids });
      return;
    default:
      throw new BoardError("Unknown message type.");
  }
}

wss.on("connection", (socket: WebSocket, req: AuthedRequest) => {
  const ws = socket as Client;
  const session = req.session!;
  ws.userId = session.uid;
  ws.kind = req.client ?? "web";
  ws.isAlive = true;
  if (!sockets.has(ws.userId)) sockets.set(ws.userId, new Set());
  sockets.get(ws.userId)!.add(ws);

  // A connection mustn't outlive the session that opened it.
  const expiry = setTimeout(() => ws.close(CLOSE_SESSION_ENDED, "Session expired"), Math.max(0, session.exp - Date.now()));

  // Full snapshot on every connect, which is also how reconnects catch up on anything missed.
  notificationsFor(ws.userId)
    .then(async (notifications) => {
      send(ws, { type: "welcome", userId: ws.userId, users: getUsers(), board: boardFor(getBoard(), ws.userId), notifications });
      if (findUser(ws.userId)?.role === "coordinator") await sendMembers(ws);
    })
    .catch((err) => {
      console.error(err);
      ws.close(1011, "Couldn't load the board");
    });

  ws.on("pong", () => (ws.isAlive = true));
  ws.on("message", (raw) => {
    let msg: BoardClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return send(ws, { type: "error", message: "Message wasn't valid JSON." });
    }
    serial(() => handle(ws, msg)).catch((err) => {
      const message = err instanceof BoardError ? err.message : "Something went wrong on the server. Your change wasn't saved.";
      if (!(err instanceof BoardError)) console.error(err);
      send(ws, { type: "error", message });
    });
  });
  ws.on("close", () => {
    clearTimeout(expiry);
    sockets.get(ws.userId)?.delete(ws);
  });
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients as Set<Client>) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 15_000);

wss.on("close", () => clearInterval(heartbeat));

/** Plain HTTP for a health check; everything else is the WebSocket upgrade. */
const http = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: true, version: getBoard().version }));
    return;
  }
  res.writeHead(426, { "Content-Type": "text/plain" }).end("Connect with a WebSocket.");
});
http.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

async function main() {
  try {
    await migrate((line) => console.log(line));
    const { people, animals } = await loadState();
    if (people === 0) console.warn("[safe-paws] The database has no people yet. Run: npm run db:seed");
    http.listen(port, () => console.log(`[safe-paws] board server on ws://localhost:${port} (${animals} animals from Postgres)`));
  } catch (err) {
    const e = err as Error & { code?: string };
    console.error(
      e.code === "ECONNREFUSED"
        ? "[safe-paws] Can't reach Postgres. Start it with `npm run db:up`, or set DATABASE_URL in .env.local."
        : `[safe-paws] Couldn't start: ${e.message}`,
    );
    process.exit(1);
  }
}

void main();

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    wss.close();
    http.close();
    void closePool().finally(() => process.exit(0));
  });
}
