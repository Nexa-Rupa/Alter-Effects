import "server-only";
import { signedGetUrl } from "@altereffects/shared/server";

/** Signed URL for an object key (null-safe). Keys are only ever produced for the caller's own org. */
export async function url(key?: string | null, expires = 3600) {
  if (!key) return null;
  return signedGetUrl(key, expires);
}
