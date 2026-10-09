import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, open, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { getUpload, insertUpload } from "@safe-paws/db";
import { UPLOAD_MAX_BYTES, UPLOAD_TYPES } from "@safe-paws/shared/schemas";
import { SESSION_COOKIE, verifySessionToken } from "@safe-paws/shared/session";

/**
 * The files live on disk next to the app for this demo (swap for S3 or
 * similar in production; only this file would change). What each file is,
 * and who uploaded it, is a row in the Postgres `uploads` table.
 */
// turbopackIgnore: uploads are runtime data, so the bundler shouldn't trace this folder into the build.
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), ".uploads");

export type MediaMeta = { id: string; kind: "photo" | "video"; type: string; name: string; size: number; by: string; at: number };

const ID = /^[a-z0-9-]{8,64}$/;
const filePath = (id: string) => path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, id);

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

export async function saveUpload(file: File, userId: string): Promise<MediaMeta> {
  const kind = UPLOAD_TYPES[file.type];
  if (!kind) throw new UploadError("Use a JPEG, PNG, WebP or HEIC photo, or an MP4, MOV or WebM video.");
  const max = UPLOAD_MAX_BYTES[kind];
  if (file.size > max) throw new UploadError(`That ${kind} is too large. The limit is ${Math.round(max / 1024 / 1024)} MB.`);
  if (file.size === 0) throw new UploadError("That file is empty.");

  const head = Buffer.from(await file.slice(0, 16).arrayBuffer());
  if (!looksLike(kind, head)) throw new UploadError(`That file doesn't look like a real ${kind}.`);

  await mkdir(/*turbopackIgnore: true*/ UPLOAD_DIR, { recursive: true });
  const id = randomUUID();
  // Stream to disk rather than buffering whole videos in memory.
  await pipeline(Readable.fromWeb(file.stream() as unknown as WebReadableStream), createWriteStream(filePath(id)));
  const meta: MediaMeta = { id, kind, type: file.type, name: file.name.slice(0, 200), size: file.size, by: userId, at: Date.now() };
  try {
    await insertUpload({ id, kind, mimeType: meta.type, name: meta.name, sizeBytes: meta.size, uploadedBy: userId });
  } catch (err) {
    await unlink(filePath(id)).catch(() => {}); // no orphaned file if the row can't be saved
    throw err;
  }
  return meta;
}

export async function readMeta(id: string): Promise<MediaMeta | null> {
  if (!ID.test(id)) return null;
  const u = await getUpload(id);
  return u ? { id: u.id, kind: u.kind, type: u.mimeType, name: u.name, size: u.sizeBytes, by: u.uploadedBy, at: u.at } : null;
}

/** A byte range of the file as a web stream. Videos need ranges so browsers can seek (Safari won't play without). */
export async function openRange(id: string, start: number, end: number) {
  const handle = await open(filePath(id), "r");
  const stream = handle.createReadStream({ start, end, autoClose: true });
  return Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>;
}

export async function fileSize(id: string) {
  return (await stat(filePath(id))).size;
}

export async function removeUpload(id: string) {
  if (!ID.test(id)) return;
  await unlink(filePath(id)).catch(() => {});
}
