"use client";

import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import CloseIcon from "@mui/icons-material/Close";
import Check from "@mui/icons-material/Check";
import ContentCopy from "@mui/icons-material/ContentCopy";
import FileUploadOutlined from "@mui/icons-material/FileUploadOutlined";
import IosShare from "@mui/icons-material/IosShare";
import OpenInNew from "@mui/icons-material/OpenInNew";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { photos } from "@safe-paws/shared/format";
import type { Animal } from "@safe-paws/shared/protocol";
import { useBoard } from "@safe-paws/shared/store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Coordinators only: draft a post with Claude (optionally about one of the
 * animals, with one of its photos) and publish it to LinkedIn and/or a
 * Facebook Page. Adapted from linkedin-post-studio.
 */

type Status = {
  claude: boolean;
  linkedIn: { configured: boolean; redirectUri: string; connectedAs: string | null };
  facebook: { configured: boolean; redirectUri: string; connectedAs: string | null; pages: { id: string; name: string }[] };
};

const TONES = [
  { id: "heartfelt", label: "Heartfelt" },
  { id: "story", label: "Story" },
  { id: "appeal", label: "Appeal for help" },
  { id: "good-news", label: "Good news" },
  { id: "updates", label: "Updates" },
] as const;

const LINKEDIN_MAX = 3000;

const ERRORS: Record<string, string> = {
  "linkedin-setup": "LinkedIn isn't set up yet. See “Setting up” at the bottom of this page.",
  "linkedin-denied": "LinkedIn wasn't connected: the request was declined.",
  "linkedin-state": "LinkedIn's answer didn't match this sign-in. Try connecting again.",
  "linkedin-token": "LinkedIn couldn't be connected.",
  "facebook-setup": "Facebook isn't set up yet. See “Setting up” at the bottom of this page.",
  "facebook-denied": "Facebook wasn't connected: the request was declined.",
  "facebook-state": "Facebook's answer didn't match this sign-in. Try connecting again.",
  "facebook-token": "Facebook couldn't be connected.",
};

/** Every photo is resized to a JPEG (max 2048px) in the browser: small, and accepted by Claude, LinkedIn and Facebook. */
async function toJpeg(source: Blob): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source);
  } catch {
    throw new Error("This browser can't read that photo. Try a JPEG or PNG.");
  }
  const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.86));
  if (!blob) throw new Error("Couldn't prepare that photo.");
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Something went wrong. Try again.");
  return json;
}

type Photo = { file: File; preview: string; from: string } | null;
type Notice = { kind: "success" | "info" | "error"; text: string } | null;

/** While connecting LinkedIn or Facebook the page goes away and comes back: keep the draft in this tab meanwhile. */
const SAVED = "safe-paws-social-draft";
type Saved = { animalId: string | null; topic: string; tone: string; post: string; photo: string | null; from: string };

function readSaved(): Saved | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SAVED);
    sessionStorage.removeItem(SAVED);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function fileFromDataUrl(dataUrl: string): File {
  const bytes = Uint8Array.from(atob(dataUrl.split(",")[1] ?? ""), (c) => c.charCodeAt(0));
  return new File([bytes], "photo.jpg", { type: "image/jpeg" });
}

const dataUrlOf = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

function noticeFromAddress(): Notice {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const connected = q.get("connected");
  const error = q.get("error");
  if (connected) return { kind: "success", text: `${connected === "linkedin" ? "LinkedIn" : "Facebook"} is connected.` };
  if (error) return { kind: "error", text: [ERRORS[error] ?? "Something went wrong.", q.get("detail")].filter(Boolean).join(" ") };
  return null;
}
type Result = { network: string; url: string; label: string };

export function SocialStudio() {
  const animals = useBoard((s) => s.board?.animals);
  const list = useMemo(() => Object.values(animals ?? {}).sort((a, b) => a.name.localeCompare(b.name)), [animals]);

  const [status, setStatus] = useState<Status | null>(null);
  // Messages from the LinkedIn / Facebook sign-in come back in the address. (Only ever rendered in the browser.)
  const [notice, setNotice] = useState<Notice>(noticeFromAddress);
  const [saved] = useState(readSaved);
  const [animal, setAnimal] = useState<Animal | null>(() => (saved?.animalId && animals?.[saved.animalId]) || null);
  const [topic, setTopic] = useState(saved?.topic ?? "");
  const [tone, setTone] = useState<(typeof TONES)[number]["id"]>(() =>
    TONES.some((t) => t.id === saved?.tone) ? (saved!.tone as (typeof TONES)[number]["id"]) : "heartfelt",
  );
  const [photo, setPhoto] = useState<Photo>(() => {
    if (!saved?.photo) return null;
    const file = fileFromDataUrl(saved.photo);
    return { file, preview: URL.createObjectURL(file), from: saved.from };
  });
  const [post, setPost] = useState(saved?.post ?? "");
  const [busy, setBusy] = useState<null | "photo" | "draft" | "linkedin" | "facebook">(null);
  const [pageId, setPageId] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [copied, setCopied] = useState(false);
  const [shareNote, setShareNote] = useState<Notice>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadStatus = useCallback(() => {
    call<Status>("/api/social")
      .then((s) => {
        setStatus(s);
        setPageId((id) => id || s.facebook.pages[0]?.id || "");
      })
      .catch((e: Error) => setNotice({ kind: "error", text: e.message }));
  }, []);

  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, "", "/social"); // tidy the address bar
    loadStatus();
  }, [loadStatus]);

  // Free the old preview when the photo changes. (Not in an effect cleanup: in development
  // React mounts twice, and that would free the preview the page is still showing.)
  const replacePhoto = (next: Photo) => {
    if (photo) URL.revokeObjectURL(photo.preview);
    setPhoto(next);
  };

  const takePhoto = async (source: Blob, from: string) => {
    setBusy("photo");
    try {
      const file = await toJpeg(source);
      replacePhoto({ file, preview: URL.createObjectURL(file), from });
    } catch (e) {
      setNotice({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const pickAnimalPhoto = async (url: string, id: string) => {
    setBusy("photo");
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Couldn't load that photo.");
      await takePhoto(await res.blob(), id);
    } catch (e) {
      setNotice({ kind: "error", text: (e as Error).message });
      setBusy(null);
    }
  };

  const form = (extra: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(extra)) f.set(k, v);
    if (photo) f.set("photo", photo.file);
    return f;
  };

  const draft = async () => {
    setBusy("draft");
    setNotice(null);
    try {
      const { post: text } = await call<{ post: string }>("/api/social/generate", {
        method: "POST",
        body: form({ topic, tone, animalId: animal?.id ?? "" }),
      });
      setPost(text);
    } catch (e) {
      setNotice({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const publish = async (network: "linkedin" | "facebook") => {
    setBusy(network);
    setNotice(null);
    try {
      const r = await call<{ url: string; pageName?: string }>(`/api/social/${network}/post`, {
        method: "POST",
        body: form({ text: post, ...(network === "facebook" && { pageId }) }),
      });
      const label = network === "linkedin" ? "LinkedIn" : `Facebook (${r.pageName})`;
      setResults((rs) => [{ network, url: r.url, label }, ...rs]);
      setNotice({ kind: "success", text: `Posted to ${label}.` });
    } catch (e) {
      setNotice({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  /** Before going to LinkedIn's or Facebook's sign-in, keep the draft so it's here on the way back. */
  const connect = async (href: string) => {
    try {
      const save: Saved = { animalId: animal?.id ?? null, topic, tone, post, photo: photo ? await dataUrlOf(photo.file) : null, from: photo?.from ?? "" };
      sessionStorage.setItem(SAVED, JSON.stringify(save));
    } catch {
      // Storage full or blocked: carry on without it.
    }
    window.location.assign(href);
  };

  const disconnect = async (network: "linkedin" | "facebook") => {
    await fetch(`/api/social/${network}`, { method: "DELETE" });
    loadStatus();
  };

  const copy = async () => {
    await navigator.clipboard.writeText(post).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /**
   * Opens the phone's share menu (Instagram, Facebook, WhatsApp…) with the photo, if
   * there is one, or else the text. Instagram and Facebook throw away text sent with a
   * photo (Meta's rules), which is why the caption is copied first, to paste in the app.
   * Where there's no share menu (most desktop browsers), the photo is saved instead.
   */
  const share = async () => {
    setShareNote(null);
    // Copy the caption too, in case that step was skipped. Not awaited: Safari only
    // opens the share menu straight from the tap.
    void navigator.clipboard?.writeText(post).catch(() => {});
    const name = `${(animal?.name ?? "egypt-animal-sos").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.jpg`;
    const data: ShareData = photo ? { files: [new File([photo.file], name, { type: "image/jpeg" })] } : { text: post };
    if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
      try {
        await navigator.share(data);
        if (photo) setShareNote({ kind: "info", text: "Now paste the caption in the app: tap the caption box, then Paste." });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setShareNote({ kind: "error", text: "Couldn't open the share menu. Try again." });
      }
      return;
    }
    if (photo) {
      const a = document.createElement("a");
      a.href = photo.preview;
      a.download = name;
      a.click();
    }
    setShareNote({
      kind: "info",
      text: `${photo ? `The photo is saved as ${name} and the caption is copied` : "The caption is copied"}. Open Instagram or Facebook and paste it in. (On a phone, Post opens the share menu instead.)`,
    });
  };

  const animalPhotos = animal ? photos(animal) : [];
  const tooLongForLinkedIn = post.length > LINKEDIN_MAX;
  const ready = !!post.trim() && !busy;

  return (
    <Box component="main" sx={{ px: { xs: 2, sm: 2.5 }, py: 3, maxWidth: 880, width: "100%", mx: "auto" }}>
      <Typography variant="h1" component="h1" sx={{ fontSize: { xs: "1.5rem", sm: "1.75rem" } }}>
        Social post
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
        Draft a post with Claude, then share it to Instagram, Facebook and more. Only coordinators can see this page.
      </Typography>

      {notice && (
        <Alert severity={notice.kind} onClose={() => setNotice(null)} sx={{ mb: 2 }} role={notice.kind === "error" ? "alert" : "status"}>
          {notice.text}
        </Alert>
      )}

      <Stack spacing={2.5}>
        {/* 1. What's it about */}
        <Card component="section" aria-labelledby="social-about" sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography id="social-about" component="h2" variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            1. What&apos;s the post about?
          </Typography>
          <Stack spacing={2.5}>
            <Autocomplete
              options={list}
              value={animal}
              onChange={(_, a) => {
                setAnimal(a);
                if (photo?.from.startsWith("animal:")) replacePhoto(null);
              }}
              getOptionLabel={(a) => a.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => (
                <TextField {...params} label="Animal (optional)" helperText="Claude uses their details and recent updates." />
              )}
            />
            <TextField
              id="social-topic"
              label="What should it say?"
              placeholder="e.g. Luna's mange is healing and she's ready for a foster home. We need help with her vet bills."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              multiline
              minRows={3}
            />
            <Box>
              <Typography component="p" variant="body2" color="text.secondary" sx={{ mb: 1 }} id="social-tone">
                Tone
              </Typography>
              <ToggleButtonGroup
                value={tone}
                exclusive
                onChange={(_, t) => t && setTone(t)}
                aria-labelledby="social-tone"
                size="small"
                sx={{ flexWrap: "wrap" }}
              >
                {TONES.map((t) => (
                  <ToggleButton key={t.id} value={t.id} sx={{ px: 1.75 }}>
                    {t.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              {tone === "updates" && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {animal ? `Claude uses ${animal.name}'s latest updates (up to 3).` : "Claude uses the 3 latest updates from all the animals."}
                </Typography>
              )}
            </Box>

            <Box>
              <Button
                variant="contained"
                size="large"
                startIcon={busy === "draft" ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeOutlined />}
                onClick={draft}
                disabled={!!busy || (topic.trim().length < 8 && !animal && tone !== "updates")}
              >
                {busy === "draft" ? "Writing…" : post ? "Write it again" : "Write it with Claude"}
              </Button>
              {status && !status.claude && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Claude isn&apos;t set up yet: see “Setting up” below. You can still write the post yourself.
                </Typography>
              )}
            </Box>
          </Stack>
        </Card>

        {/* 2. The post */}
        <Card component="section" aria-labelledby="social-post" sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack direction="row" sx={{ alignItems: "center", mb: 2 }}>
            <Typography id="social-post" component="h2" variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
              2. Your post
            </Typography>
            <Tooltip title={copied ? "Copied" : "Copy the post"}>
              <span>
                <IconButton onClick={copy} disabled={!post} aria-label={copied ? "Post copied" : "Copy the post"}>
                  <ContentCopy fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
          <TextField
            id="social-text"
            label="Post"
            value={post}
            onChange={(e) => setPost(e.target.value)}
            multiline
            minRows={8}
            fullWidth
            placeholder="Write here, or let Claude draft it above. You can edit anything before posting."
            error={tooLongForLinkedIn}
            helperText={
              tooLongForLinkedIn
                ? `${post.length} characters: LinkedIn allows ${LINKEDIN_MAX}. Shorten it to post there.`
                : `${post.length} / ${LINKEDIN_MAX} for LinkedIn`
            }
          />
        </Card>

        {/* 3. Share */}
        <Card component="section" aria-labelledby="social-share" sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography id="social-share" component="h2" variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            3. Share it
          </Typography>
          <Stack spacing={3}>
            <Box>
              <Typography sx={{ fontWeight: 700, mb: 1 }}>1. Copy the caption</Typography>
              <Button variant="outlined" startIcon={copied ? <Check /> : <ContentCopy />} onClick={copy} disabled={!post.trim()}>
                {copied ? "Caption copied" : "Copy caption"}
              </Button>
            </Box>

            <Box>
              <Typography sx={{ fontWeight: 700, mb: 1 }}>2. Add a photo (optional)</Typography>
              <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", rowGap: 1.5, alignItems: "center" }}>
                {photo && (
                  <Box sx={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- a local preview */}
                    <img src={photo.preview} alt="Chosen photo" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 10, display: "block" }} />
                    <IconButton
                      size="small"
                      aria-label="Remove photo"
                      onClick={() => replacePhoto(null)}
                      sx={{ position: "absolute", top: -10, right: -10, bgcolor: "background.paper", boxShadow: 1, "&:hover": { bgcolor: "background.paper" } }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}
                {!photo &&
                  animalPhotos.map((m) => (
                    <ButtonBase
                      key={m.id}
                      onClick={() => pickAnimalPhoto(m.url, `animal:${m.id}`)}
                      aria-label={`Use this photo of ${animal!.name}`}
                      sx={{ borderRadius: 1.25, overflow: "hidden", outline: "1px solid", outlineColor: "divider" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- private media */}
                      <img src={m.url} alt="" style={{ width: 72, height: 72, objectFit: "cover", display: "block" }} />
                    </ButtonBase>
                  ))}
                {!photo && (
                  <Button variant="outlined" startIcon={<FileUploadOutlined />} onClick={() => fileRef.current?.click()} disabled={busy === "photo"}>
                    {busy === "photo" ? "Preparing…" : "Choose a photo"}
                  </Button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void takePhoto(f, "upload");
                    e.target.value = "";
                  }}
                />
              </Stack>
              {!photo && animal && animalPhotos.length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                  Tap one of {animal.name}&apos;s photos to use it.
                </Typography>
              )}
            </Box>

            <Box>
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>3. Post</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
                {photo
                  ? "Opens your phone's share menu with the photo. Pick Instagram, Facebook or another app, then paste the caption there."
                  : "Opens your phone's share menu with the caption. Pick Facebook, WhatsApp or another app. (Instagram needs a photo.)"}
              </Typography>
              <Button variant="contained" size="large" startIcon={<IosShare />} onClick={share} disabled={!post.trim() || !!busy}>
                Post
              </Button>
              {shareNote && (
                <Alert severity={shareNote.kind} onClose={() => setShareNote(null)} sx={{ mt: 1.5 }} role={shareNote.kind === "error" ? "alert" : "status"}>
                  {shareNote.text}
                </Alert>
              )}
            </Box>
          </Stack>

          {/* Posting straight to LinkedIn or a Facebook Page only shows once it's set up. */}
          {status && (status.linkedIn.configured || status.facebook.configured) && (
            <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: "divider" }}>
              <Typography sx={{ fontWeight: 700, mb: 2 }}>Or post straight from here{photo ? ", with the photo" : ""}</Typography>
              <Stack spacing={2.5} divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}>
                {status.linkedIn.configured && (
                  <Network
                    name="LinkedIn"
                    note="Posts on your own LinkedIn profile."
                    configured
                    connectedAs={status.linkedIn.connectedAs}
                    onConnect={() => connect("/api/social/linkedin/connect")}
                    onDisconnect={() => disconnect("linkedin")}
                    action={
                      <Button variant="contained" onClick={() => publish("linkedin")} disabled={!ready || tooLongForLinkedIn}>
                        {busy === "linkedin" ? "Posting…" : "Post to LinkedIn"}
                      </Button>
                    }
                  />
                )}
                {status.facebook.configured && (
                  <Network
                    name="Facebook"
                    note="Posts as a Facebook Page you manage."
                    configured
                    connectedAs={status.facebook.connectedAs}
                    onConnect={() => connect("/api/social/facebook/connect")}
                    onDisconnect={() => disconnect("facebook")}
                    action={
                      status.facebook.pages.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          No Pages found on this Facebook account.
                        </Typography>
                      ) : (
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" } }}>
                          <TextField select size="small" label="Post as" value={pageId} onChange={(e) => setPageId(e.target.value)} sx={{ minWidth: 220 }}>
                            {status.facebook.pages.map((p) => (
                              <MenuItem key={p.id} value={p.id}>
                                {p.name}
                              </MenuItem>
                            ))}
                          </TextField>
                          <Button variant="contained" onClick={() => publish("facebook")} disabled={!ready || !pageId}>
                            {busy === "facebook" ? "Posting…" : "Post to Facebook"}
                          </Button>
                        </Stack>
                      )
                    }
                  />
                )}
              </Stack>
            </Box>
          )}

          {results.length > 0 && (
            <Stack component="ul" spacing={0.75} sx={{ listStyle: "none", p: 0, m: 0, mt: 2.5 }}>
              {results.map((r, i) => (
                <li key={i}>
                  <Link href={r.url} target="_blank" rel="noopener" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                    View the post on {r.label} <OpenInNew fontSize="inherit" />
                  </Link>
                </li>
              ))}
            </Stack>
          )}
        </Card>

        {status && <Setup status={status} />}
      </Stack>
    </Box>
  );
}

function Network({
  name,
  note,
  configured,
  connectedAs,
  onConnect,
  onDisconnect,
  action,
}: {
  name: string;
  note: string;
  configured: boolean;
  connectedAs: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  action: React.ReactNode;
}) {
  return (
    <Box>
      <Stack direction="row" useFlexGap sx={{ alignItems: "baseline", flexWrap: "wrap", columnGap: 1, mb: 1.25 }}>
        <Typography sx={{ fontWeight: 700 }}>{name}</Typography>
        <Typography variant="body2" color="text.secondary">
          {connectedAs ? `Connected as ${connectedAs}.` : note}
        </Typography>
        {connectedAs && (
          <Button size="small" color="inherit" onClick={onDisconnect} sx={{ ml: "auto !important", color: "text.secondary" }}>
            Disconnect
          </Button>
        )}
      </Stack>
      {!configured ? (
        <Typography variant="body2" color="text.secondary">
          Not set up yet: see “Setting up” below.
        </Typography>
      ) : connectedAs ? (
        action
      ) : (
        <Button variant="outlined" onClick={onConnect}>
          Connect {name}
        </Button>
      )}
    </Box>
  );
}

/** What's still needed, with the exact redirect URLs to paste into the LinkedIn and Facebook apps. */
function Setup({ status }: { status: Status }) {
  const [open, setOpen] = useState(false); // closed until wanted
  const row = (ok: boolean, label: string, detail: React.ReactNode) => (
    <Box component="li" sx={{ mb: 1.5 }}>
      <Typography sx={{ fontWeight: 600 }}>
        {ok ? "✓" : "○"} {label}
      </Typography>
      <Typography variant="body2" color="text.secondary" component="div" sx={{ lineHeight: 1.6 }}>
        {detail}
      </Typography>
    </Box>
  );
  const code = (t: string) => (
    <Box component="code" sx={{ bgcolor: "action.hover", px: 0.75, py: 0.25, borderRadius: 0.75, fontSize: "0.85em", wordBreak: "break-all" }}>
      {t}
    </Box>
  );
  return (
    <Card component="section" aria-labelledby="social-setup" sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack direction="row" sx={{ alignItems: "center" }}>
        <Typography id="social-setup" component="h2" variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
          Setting up
        </Typography>
        <Button size="small" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="social-setup-body">
          {open ? "Hide" : "Show"}
        </Button>
      </Stack>
      <Collapse in={open}>
        <Box id="social-setup-body" component="ul" sx={{ listStyle: "none", p: 0, m: 0, mt: 2 }}>
          {row(status.claude, "Claude", <>Add {code("ANTHROPIC_API_KEY")} to the site&apos;s environment variables (Vercel: Settings → Environment Variables), then redeploy.</>)}
          {row(
            status.linkedIn.configured,
            "LinkedIn",
            <>
              Create a LinkedIn developer app and add the products “Share on LinkedIn” and “Sign In with LinkedIn using OpenID Connect”.
              Add this redirect URL under Auth: {code(status.linkedIn.redirectUri)}. Then add {code("LINKEDIN_CLIENT_ID")} and{" "}
              {code("LINKEDIN_CLIENT_SECRET")} to the environment variables.
            </>,
          )}
          {row(
            status.facebook.configured,
            "Facebook",
            <>
              Create a Facebook app with Facebook Login. Add this Valid OAuth Redirect URI: {code(status.facebook.redirectUri)}. Then add{" "}
              {code("FACEBOOK_APP_ID")} and {code("FACEBOOK_APP_SECRET")} to the environment variables. Posting to Pages for people other
              than the app&apos;s admins needs Facebook&apos;s App Review.
            </>,
          )}
        </Box>
      </Collapse>
    </Card>
  );
}
