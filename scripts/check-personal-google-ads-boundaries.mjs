import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const requiredFiles = [
  "src/extensions/personal-google-ads/server-functions.ts",
  "src/extensions/personal-google-ads/bridge/openseo.ts",
  "src/routes/_project/p/$projectId/google-ads-planner.tsx",
];
const markedBridges = ["src/client/navigation/items.ts"];
const marker = "PERSONAL_GOOGLE_ADS_EXTENSION";

for (const file of requiredFiles) {
  const path = resolve(root, file);
  if (!statSync(path).isFile())
    throw new Error(`Missing extension file: ${file}`);
}

for (const file of markedBridges) {
  const contents = readFileSync(resolve(root, file), "utf8");
  if (!contents.includes(marker)) {
    throw new Error(`Missing ${marker} bridge marker in ${file}`);
  }
}

console.log("Personal Google Ads extension boundaries are intact.");
