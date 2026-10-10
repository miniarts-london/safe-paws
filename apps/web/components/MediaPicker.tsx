"use client";

import AddPhotoAlternateOutlined from "@mui/icons-material/AddPhotoAlternateOutlined";
import CloseIcon from "@mui/icons-material/Close";
import ImageOutlined from "@mui/icons-material/ImageOutlined";
import PlayCircleOutlined from "@mui/icons-material/PlayCircleOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { MEDIA_MAX, UPLOAD_MAX_BYTES, UPLOAD_TYPES } from "@safe-paws/shared/schemas";
import { useEffect, useRef, useState, type DragEvent } from "react";

export type PickedMedia = { id: string; kind: "photo" | "video"; name: string };

type Pending = {
  key: string;
  name: string;
  kind: "photo" | "video";
  preview: string;
  progress: number;
  error?: string;
};

type Props = {
  value: PickedMedia[];
  onChange: (next: PickedMedia[]) => void;
  /** Tells the form how many uploads are still running, so it can't save half-uploaded media. */
  onBusyChange: (uploading: number) => void;
  error?: string;
};

const ACCEPT = Object.keys(UPLOAD_TYPES).join(",");

/** Through this server (local development). XHR rather than fetch because it reports upload progress. */
function uploadViaServer(file: File, onProgress: (fraction: number) => void) {
  return new Promise<PickedMedia>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let json: { id?: string; kind?: "photo" | "video"; name?: string; error?: string } = {};
      try {
        json = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status === 201 && json.id && json.kind) resolve({ id: json.id, kind: json.kind, name: json.name ?? file.name });
      else reject(new Error(json.error ?? "The upload failed. Try again."));
    };
    xhr.onerror = () => reject(new Error("The upload failed. Check your connection and try again."));
    const body = new FormData();
    body.append("file", file);
    xhr.send(body);
  });
}

/**
 * Straight from the browser to the private Blob store (on Vercel, which won't
 * take large files through the server), then the server checks and records it.
 */
async function uploadDirect(file: File, onProgress: (fraction: number) => void): Promise<PickedMedia> {
  const { upload: toBlob } = await import("@vercel/blob/client");
  const id = crypto.randomUUID();
  try {
    await toBlob(`media/${id}`, file, {
      access: "private",
      handleUploadUrl: "/api/media/upload",
      clientPayload: JSON.stringify({ type: file.type, size: file.size }),
      contentType: file.type,
      multipart: file.size > 8 * 1024 * 1024, // big videos go up in parallel parts, with retries
      onUploadProgress: ({ percentage }) => onProgress(Math.min(percentage, 99) / 100),
    });
  } catch (err) {
    // Show the real reason (e.g. "too large", or a storage problem), without the library's prefix.
    console.error("Upload to storage failed:", err);
    const text = ((err as Error).message ?? "").replace(/^Vercel Blob:\s*/i, "").trim();
    throw new Error(text ? `The upload failed: ${text}` : "The upload failed. Check your connection and try again.");
  }
  const res = await fetch("/api/media/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, name: file.name }),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; kind?: "photo" | "video"; name?: string; error?: string };
  if (res.status !== 201 || !json.id || !json.kind) throw new Error(json.error ?? "The upload failed. Try again.");
  onProgress(1);
  return { id: json.id, kind: json.kind, name: json.name ?? file.name };
}

/** Asked once per page: does this site upload straight to Blob? */
let direct: Promise<boolean> | null = null;
const usesDirect = () =>
  (direct ??= fetch("/api/media/upload")
    .then((r) => (r.ok ? r.json() : { direct: false }))
    .then((j: { direct?: boolean }) => !!j.direct)
    .catch(() => {
      direct = null; // try again next time
      return false;
    }));

async function upload(file: File, onProgress: (fraction: number) => void) {
  return (await usesDirect()) ? uploadDirect(file, onProgress) : uploadViaServer(file, onProgress);
}

/** Checks a file before uploading, with the same limits the server enforces. */
function precheck(file: File): { kind: "photo" | "video" } | { error: string } {
  const kind = UPLOAD_TYPES[file.type];
  if (!kind) return { error: "Use a JPEG, PNG, WebP or HEIC photo, or an MP4, MOV or WebM video." };
  const max = UPLOAD_MAX_BYTES[kind];
  if (file.size > max) return { error: `Too large: the ${kind} limit is ${Math.round(max / 1024 / 1024)} MB.` };
  return { kind };
}

export function MediaPicker({ value, onChange, onBusyChange, error }: Props) {
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Uploads finish in any order and often in the same tick. Each one must add to the latest
  // list, not the one it saw when it started, or simultaneous finishes overwrite each other.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  const commit = (next: PickedMedia[]) => {
    valueRef.current = next;
    onChange(next);
  };

  const uploading = pending.filter((p) => !p.error).length;
  useEffect(() => onBusyChange(uploading), [uploading, onBusyChange]);

  // Free the in-memory previews when the form closes.
  const previews = useRef(new Set<string>());
  useEffect(() => {
    const set = previews.current;
    return () => set.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const room = MEDIA_MAX - value.length - uploading;
  const keySeq = useRef(0);

  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, Math.max(0, room));
    for (const file of list) {
      const key = `upload-${++keySeq.current}`;
      const checked = precheck(file);
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      const kind = "kind" in checked ? checked.kind : file.type.startsWith("video") ? "video" : "photo";
      setPending((p) => [...p, { key, name: file.name, kind, preview, progress: 0, error: "error" in checked ? checked.error : undefined }]);
      if ("error" in checked) continue;
      upload(file, (progress) => setPending((p) => p.map((x) => (x.key === key ? { ...x, progress } : x))))
        .then((done) => {
          setPending((p) => p.filter((x) => x.key !== key));
          commit([...valueRef.current, done]);
        })
        .catch((err: Error) => setPending((p) => p.map((x) => (x.key === key ? { ...x, error: err.message } : x))));
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  return (
    <Stack spacing={1}>
      <Box
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
          gap: 1,
          p: 1,
          border: "1.5px dashed",
          borderColor: dragging ? "mint.dark" : error ? "error.main" : "divider",
          bgcolor: dragging ? "mint.light" : "transparent",
          borderRadius: 3,
          transition: "background-color .15s, border-color .15s",
        }}
      >
        {value.map((m) => (
          <Tile
            key={m.id}
            name={m.name}
            kind={m.kind}
            src={`/api/media/${m.id}`}
            onRemove={() => commit(valueRef.current.filter((x) => x.id !== m.id))}
          />
        ))}
        {pending.map((p) => (
          <Tile
            key={p.key}
            name={p.name}
            kind={p.kind}
            src={p.preview}
            progress={p.error ? undefined : p.progress}
            error={p.error}
            onRemove={() => setPending((all) => all.filter((x) => x.key !== p.key))}
          />
        ))}
        {room > 0 && (
          <Button
            variant="text"
            onClick={() => inputRef.current?.click()}
            sx={{ aspectRatio: "1", flexDirection: "column", gap: 0.5, borderRadius: 2, color: "text.secondary", minWidth: 0 }}
          >
            <AddPhotoAlternateOutlined />
            <Typography variant="caption">Add</Typography>
          </Button>
        )}
      </Box>
      <Typography variant="caption" color={error ? "error" : "text.secondary"}>
        {error ??
          `Photos or videos, up to ${MEDIA_MAX}. Drop files here or tap Add; on a phone you can take them with the camera.`}
      </Typography>
      <input
        ref={inputRef}
        id="media-input"
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = ""; // lets the same file be picked again after removing it
        }}
      />
    </Stack>
  );
}

function Tile({
  name,
  kind,
  src,
  progress,
  error,
  onRemove,
}: {
  name: string;
  kind: "photo" | "video";
  src: string;
  progress?: number;
  error?: string;
  onRemove: () => void;
}) {
  const [broken, setBroken] = useState(false); // e.g. HEIC, which most desktop browsers can't preview
  return (
    <Box
      title={error ?? name}
      sx={{ position: "relative", aspectRatio: "1", borderRadius: 2, overflow: "hidden", bgcolor: "background.column", border: 1, borderColor: error ? "error.main" : "divider" }}
    >
      {kind === "video" ? (
        <video src={src} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : broken ? (
        <Stack sx={{ height: "100%", alignItems: "center", justifyContent: "center", color: "text.secondary", p: 1 }}>
          <ImageOutlined />
          <Typography variant="caption" noWrap sx={{ maxWidth: "100%" }}>
            {name}
          </Typography>
        </Stack>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- private, auth-gated media; next/image's optimiser can't fetch it
        <img src={src} alt={name} onError={() => setBroken(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      )}
      {kind === "video" && progress === undefined && !error && (
        <PlayCircleOutlined sx={{ position: "absolute", left: 6, bottom: 6, color: "#fff", filter: "drop-shadow(0 1px 2px rgba(0,0,0,.6))" }} />
      )}
      {progress !== undefined && (
        <LinearProgress
          variant="determinate"
          value={progress * 100}
          aria-label={`Uploading ${name}`}
          sx={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 5 }}
        />
      )}
      {error && (
        <Typography
          variant="caption"
          role="alert"
          sx={{ position: "absolute", inset: 0, p: 1, bgcolor: "rgba(0,0,0,.65)", color: "#fff", lineHeight: 1.3, overflow: "hidden" }}
        >
          {error}
        </Typography>
      )}
      <IconButton
        size="small"
        aria-label={`Remove ${name}`}
        onClick={onRemove}
        sx={{ position: "absolute", top: 4, right: 4, bgcolor: "rgba(0,0,0,.55)", color: "#fff", "&:hover": { bgcolor: "rgba(0,0,0,.75)" } }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
