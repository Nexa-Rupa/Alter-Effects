// Download one object from storage: tsx --env-file=../../.env scripts/fetch-object.ts <key> <outFile>
import { downloadTo } from "@altereffects/shared/server";
const [key, out] = process.argv.slice(2);
downloadTo(key, out).then(() => console.log("saved", out)).catch(e => { console.error(e); process.exit(1); });
