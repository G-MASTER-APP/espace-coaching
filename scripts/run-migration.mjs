import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const envPath = process.argv[2];
const sqlPath = process.argv[3];

const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const sql = readFileSync(sqlPath, "utf8");

const { error } = await admin.rpc("exec_sql", { sql });
if (error) {
  console.error("Erreur migration:", error);
  process.exit(1);
}
console.log("Migration appliquée:", sqlPath);
