import { issueSignedToken } from "@vercel/blob";
import { handleUpload, handleUploadPresigned, type HandleUploadBody, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { BLOB_PATH, blobAuth, checkFile, requireUploader, usingBlob } from "@/lib/media";

/**
 * Tells the form how to upload: straight to Blob (on Vercel), or through this server.
 * Also handy for checking the setup: open /api/media/upload on the live site.
 */
export function GET() {
  return Response.json({
    direct: usingBlob(),
    auth: blobAuth(),
    onVercel: !!process.env.VERCEL,
    blobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    blobStore: !!process.env.BLOB_STORE_ID,
  });
}

/** The same checks for both kinds of store: staff only, a fresh media/<uuid> path, an allowed type and size. */
async function allow(req: Request, pathname: string, clientPayload: string | null) {
  await requireUploader(req);
  if (!BLOB_PATH.test(pathname)) throw new Error("That upload path isn't allowed.");
  const { type, size } = JSON.parse(clientPayload ?? "{}") as { type?: string; size?: number };
  const { max } = checkFile(String(type), Number(size));
  return { type: String(type), max };
}

/**
 * Lets the browser upload one file straight to the private Blob store, after
 * the checks above. No overwriting. Once it's up, the browser calls
 * ../register, which checks the file itself before recording it.
 *  - Stores with a fixed key: a short-lived client token (handleUpload).
 *  - Stores on Vercel's OIDC sign-in: a short-lived presigned upload link.
 */
export async function POST(req: Request) {
  const auth = blobAuth();
  if (!auth) return Response.json({ error: "Direct uploads aren't set up here." }, { status: 404 });
  try {
    if (auth === "token") {
      const body = (await req.json()) as HandleUploadBody;
      const json = await handleUpload({
        body,
        request: req,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          const { type, max } = await allow(req, pathname, clientPayload);
          return { allowedContentTypes: [type], maximumSizeInBytes: max, addRandomSuffix: false, allowOverwrite: false };
        },
      });
      return Response.json(json);
    }
    const body = (await req.json()) as HandleUploadPresignedBody;
    const json = await handleUploadPresigned({
      body,
      request: req,
      getSignedToken: async (pathname, clientPayload) => {
        const { type, max } = await allow(req, pathname, clientPayload);
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          allowedContentTypes: [type],
          maximumSizeInBytes: max,
          validUntil: Date.now() + 15 * 60 * 1000, // long enough for a big video on a slow connection
        });
        return { token, urlOptions: { allowOverwrite: false, addRandomSuffix: false } };
      },
    });
    return Response.json(json);
  } catch (err) {
    console.error("[media] upload refused:", err);
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
