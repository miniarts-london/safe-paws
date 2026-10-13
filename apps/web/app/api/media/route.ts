import { appCors } from "@/lib/appCors";
import { requireUploader, saveUpload, UploadError } from "@/lib/media";

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: appCors(req, "POST") });
}

/**
 * Upload one photo or video through this server: used locally, and by the
 * phone app. On Vercel the website uploads straight to Blob instead (see
 * ./upload), because Vercel only accepts requests up to 4.5 MB here.
 */
export async function POST(req: Request) {
  const headers = appCors(req, "POST"); // the phone app's web preview
  let userId: string;
  try {
    userId = await requireUploader(req);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 401, headers });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Send the file as multipart form data." }, { status: 400, headers });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file was sent." }, { status: 400, headers });

  try {
    const meta = await saveUpload(file, userId);
    return Response.json({ id: meta.id, kind: meta.kind, name: meta.name, url: `/api/media/${meta.id}` }, { status: 201, headers });
  } catch (err) {
    if (err instanceof UploadError) return Response.json({ error: err.message }, { status: 400, headers });
    console.error(err);
    return Response.json({ error: "The upload failed. Try again." }, { status: 500, headers });
  }
}
