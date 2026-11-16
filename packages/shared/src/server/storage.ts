import { GetObjectCommand, PutObjectCommand, S3Client, HeadObjectCommand, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";

// S3-compatible object storage (MinIO locally, Cloudflare R2 / AWS S3 in production).

let client: S3Client | null = null;
export function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || "auto",
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return client;
}

const bucket = () => process.env.S3_BUCKET || "altereffects";

export async function putObject(key: string, body: Buffer | Uint8Array | string, contentType?: string) {
  await ensureBucket();
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
  return key;
}

export async function putFile(key: string, filePath: string, contentType?: string) {
  return putObject(key, await readFile(filePath), contentType);
}

export async function downloadTo(key: string, filePath: string) {
  const res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  await mkdir(dirname(filePath), { recursive: true });
  await pipeline(res.Body as Readable, createWriteStream(filePath));
  return filePath;
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  return Buffer.from(await (res.Body as any).transformToByteArray());
}

export async function exists(key: string) {
  try { await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key })); return true; } catch { return false; }
}

/** Client for links handed to browsers. S3_PUBLIC_ENDPOINT is the address browsers can reach when it differs
    from the server's (e.g. Docker: server uses http://s3:9000, browsers http://localhost:9000). Signing is
    offline, so this client never needs to reach that address itself. */
let publicClient: S3Client | null = null;
function publicS3(): S3Client {
  const endpoint = process.env.S3_PUBLIC_ENDPOINT;
  if (!endpoint || endpoint === process.env.S3_ENDPOINT) return s3();
  return (publicClient ??= new S3Client({
    endpoint,
    region: process.env.S3_REGION || "auto",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID || "", secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "" },
  }));
}

export async function signedGetUrl(key: string, expiresIn = 3600) {
  return getSignedUrl(publicS3(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn });
}

export async function signedPutUrl(key: string, contentType: string, expiresIn = 3600) {
  return getSignedUrl(publicS3(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }), { expiresIn });
}

let bucketReady: Promise<void> | null = null;
/** Create the bucket on first use (local RustFS/MinIO); a no-op when it already exists. */
export function ensureBucket() {
  bucketReady ??= (async () => {
    try { await s3().send(new HeadBucketCommand({ Bucket: bucket() })); }
    catch {
      await s3().send(new CreateBucketCommand({ Bucket: bucket() })).catch(e => {
        if (/Owned|Exists/i.test(String(e?.name))) return;
        // Cloudflare R2 / S3 tokens scoped to one bucket may not list or create buckets. Assume the bucket was
        // created in the dashboard; a real problem then surfaces on the first read or write with a clear error.
        if (/AccessDenied|Forbidden|Unauthorized|NotImplemented/i.test(String(e?.name)) || [401, 403, 501].includes(e?.$metadata?.httpStatusCode)) {
          console.warn(`[storage] could not check or create bucket "${bucket()}" (${e?.name}); assuming it exists`);
          return;
        }
        throw e;
      });
    }
  })().catch(e => { bucketReady = null; throw e; });
  return bucketReady;
}

/** Stream an upload (any size) to storage with multipart. */
export async function uploadStream(key: string, body: Readable | ReadableStream | Buffer, contentType?: string) {
  await ensureBucket();
  await new Upload({ client: s3(), params: { Bucket: bucket(), Key: key, Body: body as any, ContentType: contentType }, queueSize: 4, partSize: 8 * 1024 * 1024 }).done();
  return key;
}

/** Stream an object (optionally a byte range, e.g. "bytes=0-") for a same-origin media proxy. */
export async function getObjectStream(key: string, range?: string | null) {
  const res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key, Range: range || undefined }));
  return {
    body: res.Body as Readable,
    contentType: res.ContentType,
    contentLength: res.ContentLength,
    contentRange: res.ContentRange,
    partial: !!res.ContentRange,
    etag: res.ETag,
  };
}
