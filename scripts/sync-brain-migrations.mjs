import { copyFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const mappings = [
  [
    "supabase/migrations/20260815143000_brain_central_runtime.sql",
    "database/migrations/0074_brain_central_runtime.sql",
  ],
  [
    "supabase/migrations/20260815190000_brain_teams_knowledge_autopilot.sql",
    "database/migrations/0075_brain_teams_knowledge_autopilot.sql",
  ],
];

const checkOnly = process.argv.includes("--check");
let mismatch = false;

for (const [sourceRelative, targetRelative] of mappings) {
  const source = path.join(root, sourceRelative);
  const target = path.join(root, targetRelative);
  if (checkOnly) {
    let targetContents = null;
    try {
      targetContents = readFileSync(target, "utf8");
    } catch {
      // Missing generated target is a mismatch.
    }
    if (readFileSync(source, "utf8") !== targetContents) {
      mismatch = true;
      console.error(`Migration out of sync: ${targetRelative}`);
    }
  } else {
    copyFileSync(source, target);
    console.log(`Synced ${targetRelative}`);
  }
}

if (mismatch) process.exitCode = 1;
