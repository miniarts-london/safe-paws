import { saveUpload, sessionFrom, UploadError } from "@/lib/media";

/** Upload one photo or video. The form uploads each file as soon as it's picked. */
export async function POST(req: Request) {
  const session = sessionFrom(req);
  if (!session) return Response.json({ error: "Sign in to upload." }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Send the file as multipart form data." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file was sent." }, { status: 400 });

  try {
    const meta = await saveUpload(file, session.uid);
    return Response.json({ id: meta.id, kind: meta.kind, name: meta.name, url: `/api/media/${meta.id}` }, { status: 201 });
  } catch (err) {
    if (err instanceof UploadError) return Response.json({ error: err.message }, { status: 400 });
    console.error(err);
    return Response.json({ error: "The upload failed. Try again." }, { status: 500 });
  }
}
