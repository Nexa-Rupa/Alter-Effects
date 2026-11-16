/** Where to go after sign-in: only same-site paths (no "//host", "/\host" or schemes), else the dashboard. */
export const safeNext = (v: unknown) => {
  const s = String(v ?? "");
  return /^\/(?![/\\])[\w\-./?=&%#]*$/.test(s) ? s : "/app";
};
