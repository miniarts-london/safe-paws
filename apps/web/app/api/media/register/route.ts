import { registerBlobUpload, requireUploader, UploadError } from "@/lib/media";

/** After a direct upload to Blob: check the file that arrived, then record it. */
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireUploader(req);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 401 });
  }
  const { id, name } = (await req.json().catch(() => ({}))) as { id?: string; name?: string };
  if (!id) return Response.json({ error: "No upload id was sent." }, { status: 400 });
  try {
    const meta = await registerBlobUpload(id, String(name ?? "file"), userId);
    return Response.json({ id: meta.id, kind: meta.kind, name: meta.name, url: `/api/media/${meta.id}` }, { status: 201 });
  } catch (err) {
    if (err instanceof UploadError) return Response.json({ error: err.message }, { status: 400 });
    console.error("[media] register failed:", err);
    return Response.json({ error: `The upload failed: ${(err as Error).message}` }, { status: 500 });
  }
}
