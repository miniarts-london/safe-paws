import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, open, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { del, get, head, put } from "@vercel/blob";
import { getUpload, getUser, insertUpload } from "@safe-paws/db";
import { isStaff } from "@safe-paws/shared/protocol";
import { UPLOAD_MAX_BYTES, UPLOAD_TYPES } from "@safe-paws/shared/schemas";
import { SESSION_COOKIE, verifySessionToken } from "@safe-paws/shared/session";

/**
 * Where photos and videos live:
 * - On Vercel, in a private Vercel Blob store (when BLOB_READ_WRITE_TOKEN is set).
 *   Vercel's servers can't keep files on disk, and only accept requests up to
 *   4.5 MB, so the browser uploads straight to Blob instead.
 * - Locally, in a folder on disk, so development needs no setup.
 * Either way, what each file is and who uploaded it is a row in the Postgres
 * `uploads` table, and files are only served to signed-in people.
 */
export const usingBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

// turbopackIgnore: uploads are runtime data, so the bundler shouldn't trace this folder into the build.
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), ".uploads");

export type MediaMeta = { id: string; kind: "photo" | "video"; type: string; name: string; size: number; by: string; at: number };

const ID = /^[a-z0-9-]{8,64}$/;
const filePath = (id: string) => path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, id);
/** Blob pathname for an upload. The browser picks a fresh UUID; the server checks the shape. */
export const blobPath = (id: string) => `media/${id}`;
export const BLOB_PATH = /^media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

/** Signed in via the web cookie, or the mobile app's Bearer token. */
export function sessionFrom(req: Request) {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (bearer) return verifySessionToken(bearer);
  const cookie = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim().split("="))
    .find(([k]) => k === SESSION_COOKIE)?.[1];
  return verifySessionToken(cookie ? decodeURIComponent(cookie) : undefined);
}

export class UploadError extends Error {}

/** Only staff add photos and videos (members can look, not edit). Returns the user id. */
export async function requireUploader(req: Request) {
  const session = sessionFrom(req);
  if (!session) throw new UploadError("Sign in to upload.");
  const user = await getUser(session.uid);
  if (!isStaff(user?.role)) throw new UploadError("Only staff can add photos and videos.");
  return session.uid;
}

/** The same checks the form makes, on the type and size the file claims. */
export function checkFile(type: string, size: number) {
  const kind = UPLOAD_TYPES[type];
  if (!kind) throw new UploadError("Use a JPEG, PNG, WebP or HEIC photo, or an MP4, MOV or WebM video.");
  const max = UPLOAD_MAX_BYTES[kind];
  if (size > max) throw new UploadError(`That ${kind} is too large. The limit is ${Math.round(max / 1024 / 1024)} MB.`);
  if (size === 0) throw new UploadError("That file is empty.");
  return { kind, max };
}

/**
 * Checks the file's first bytes, not just the type the browser claims, so a
 * renamed HTML or script file can't be stored and served back as a "photo".
 */
function looksLike(kind: "photo" | "video", head: Buffer) {
  const hex = head.subarray(0, 4).toString("hex");
  const ascii = head.subarray(0, 12).toString("latin1");
  const isoBrand = ascii.slice(4, 8) === "ftyp"; // MP4, MOV, HEIC all start with an ISO box
  if (kind === "photo") {
    return (
      hex.startsWith("ffd8ff") || // JPEG
      hex === "89504e47" || // PNG
      (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") ||
      (isoBrand && /^(heic|heix|hevc|mif1|msf1|avif)/.test(ascii.slice(8, 12)))
    );
  }
  return isoBrand || hex === "1a45dfa3"; // MP4/MOV, or WebM
}

async function record(meta: MediaMeta, undo: () => Promise<unknown>) {
  try {
    await insertUpload({ id: meta.id, kind: meta.kind, mimeType: meta.type, name: meta.name, sizeBytes: meta.size, uploadedBy: meta.by });
  } catch (err) {
    await undo().catch(() => {}); // no orphaned file if the row can't be saved
    throw err;
  }
  return meta;
}

/** A file sent through this server (local development, and small files from the phone app). */
export async function saveUpload(file: File, userId: string): Promise<MediaMeta> {
  // On Vercel the disk can't keep files: say what's missing rather than failing quietly.
  if (process.env.VERCEL && !usingBlob()) {
    throw new UploadError(
      process.env.BLOB_STORE_ID
        ? "Photo storage is connected but has no BLOB_READ_WRITE_TOKEN. Check the Blob store's environment variables in Vercel, then redeploy."
        : "Photo storage isn't set up on this site yet. Connect a private Vercel Blob store to the project, then redeploy.",
    );
  }
  const { kind } = checkFile(file.type, file.size);
  const firstBytes = Buffer.from(await file.slice(0, 16).arrayBuffer());
  if (!looksLike(kind, firstBytes)) throw new UploadError(`That file doesn't look like a real ${kind}.`);

  const id = randomUUID();
  const meta: MediaMeta = { id, kind, type: file.type, name: file.name.slice(0, 200), size: file.size, by: userId, at: Date.now() };

  if (usingBlob()) {
    await put(blobPath(id), file, { access: "private", contentType: file.type, addRandomSuffix: false });
    return record(meta, () => del(blobPath(id)));
  }

  await mkdir(/*turbopackIgnore: true*/ UPLOAD_DIR, { recursive: true });
  // Stream to disk rather than buffering whole videos in memory.
  await pipeline(Readable.fromWeb(file.stream() as unknown as WebReadableStream), createWriteStream(filePath(id)));
  return record(meta, () => unlink(filePath(id)));
}

/**
 * After the browser has uploaded straight to Blob: check what actually arrived
 * (type, size, first bytes) and only then record it. Anything wrong is deleted.
 */
export async function registerBlobUpload(id: string, name: string, userId: string): Promise<MediaMeta> {
  const pathname = blobPath(id);
  if (!BLOB_PATH.test(pathname)) throw new UploadError("That upload id isn't valid.");
  if (await getUpload(id)) throw new UploadError("That file is already saved.");

  const info = await head(pathname).catch(() => null);
  if (!info) throw new UploadError("The upload didn't arrive. Try again.");
  try {
    const { kind } = checkFile(info.contentType, info.size);
    const start = await get(pathname, { access: "private", useCache: false, headers: { Range: "bytes=0-15" } });
    const firstBytes = start?.stream ? Buffer.from(await new Response(start.stream).arrayBuffer()).subarray(0, 16) : Buffer.alloc(0);
    if (!looksLike(kind, firstBytes)) throw new UploadError(`That file doesn't look like a real ${kind}.`);
    const meta: MediaMeta = { id, kind, type: info.contentType, name: name.slice(0, 200), size: info.size, by: userId, at: Date.now() };
    return await record(meta, () => del(pathname));
  } catch (err) {
    await del(pathname).catch(() => {});
    throw err;
  }
}

export async function readMeta(id: string): Promise<MediaMeta | null> {
  if (!ID.test(id)) return null;
  const u = await getUpload(id);
  return u ? { id: u.id, kind: u.kind, type: u.mimeType, name: u.name, size: u.sizeBytes, by: u.uploadedBy, at: u.at } : null;
}

/** "bytes=500-" (from 500), "bytes=-500" (last 500), or "bytes=0-999", clamped to the file. */
function parseRange(header: string | null, size: number): { start: number; end: number } | "invalid" | null {
  const m = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!m || (!m[1] && !m[2])) return null;
  let start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
  let end = m[1] && m[2] ? Number(m[2]) : size - 1;
  end = Math.min(end, size - 1);
  if (start > end || start >= size) return "invalid";
  start = Math.max(0, start);
  return { start, end };
}

/** Serves an upload with byte ranges, so videos can seek (Safari won't play without them). */
export async function serveMedia(req: Request, meta: MediaMeta): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": meta.type,
    "Accept-Ranges": "bytes",
    // Ids are never reused, so the browser can keep this forever; private because it needs sign-in.
    "Cache-Control": "private, max-age=31536000, immutable",
    // Never let the browser guess a different (executable) type.
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
  };
  const size = meta.size;
  const range = parseRange(req.headers.get("range"), size);
  if (range === "invalid") return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });

  if (usingBlob()) {
    const result = await get(blobPath(meta.id), {
      access: "private",
      ...(range && { headers: { Range: `bytes=${range.start}-${range.end}` } }),
    });
    if (!result?.stream) return new Response("Not found.", { status: 404 });
    if (range) {
      return new Response(result.stream, {
        status: 206,
        headers: { ...headers, "Content-Range": `bytes ${range.start}-${range.end}/${size}`, "Content-Length": String(range.end - range.start + 1) },
      });
    }
    return new Response(result.stream, { headers: { ...headers, "Content-Length": String(size) } });
  }

  const onDisk = (await stat(filePath(meta.id)).catch(() => null))?.size;
  if (onDisk === undefined) return new Response("Not found.", { status: 404 });
  const { start, end } = range ?? { start: 0, end: onDisk - 1 };
  const handle = await open(filePath(meta.id), "r");
  const body = Readable.toWeb(handle.createReadStream({ start, end, autoClose: true })) as unknown as ReadableStream<Uint8Array>;
  return range
    ? new Response(body, {
        status: 206,
        headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${onDisk}`, "Content-Length": String(end - start + 1) },
      })
    : new Response(body, { headers: { ...headers, "Content-Length": String(onDisk) } });
}

export async function removeUpload(id: string) {
  if (!ID.test(id)) return;
  if (usingBlob()) await del(blobPath(id)).catch(() => {});
  else await unlink(filePath(id)).catch(() => {});
}
