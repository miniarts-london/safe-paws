import { pool } from "./pool";

export type UploadRecord = {
  id: string;
  kind: "photo" | "video";
  mimeType: string;
  name: string;
  sizeBytes: number;
  uploadedBy: string;
  at: number;
};

export async function insertUpload(u: Omit<UploadRecord, "at">) {
  await pool().query(
    "insert into uploads (id, kind, mime_type, name, size_bytes, uploaded_by) values ($1,$2,$3,$4,$5,$6)",
    [u.id, u.kind, u.mimeType, u.name, u.sizeBytes, u.uploadedBy],
  );
}

/** True when the file is shown on an animal's profile (so visitors may see it too). */
export async function isAnimalMedia(uploadId: string) {
  const { rowCount } = await pool().query("select 1 from animal_media where upload_id = $1 limit 1", [uploadId]);
  return (rowCount ?? 0) > 0;
}

export async function getUpload(id: string): Promise<UploadRecord | null> {
  const { rows } = await pool().query<{
    id: string; kind: UploadRecord["kind"]; mime_type: string; name: string; size_bytes: string; uploaded_by: string; at: Date;
  }>("select * from uploads where id = $1", [id]);
  const r = rows[0];
  return r
    ? { id: r.id, kind: r.kind, mimeType: r.mime_type, name: r.name, sizeBytes: Number(r.size_bytes), uploadedBy: r.uploaded_by, at: r.at.getTime() }
    : null;
}
