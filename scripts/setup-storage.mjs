import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: buckets } = await admin.storage.listBuckets();
if (!buckets?.some((b) => b.id === "bilan-photos")) {
  const { error } = await admin.storage.createBucket("bilan-photos", {
    public: false,
    fileSizeLimit: "10MB",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic"],
  });
  if (error) throw error;
  console.log("Bucket bilan-photos créé.");
} else {
  console.log("Bucket bilan-photos déjà présent.");
}

// Chemin objet attendu : "{user_id}/{fichier}" — sert de clé pour les
// policies (chacun ne peut agir que sous son propre dossier, un coach
// sous celui de ses clients via is_coach_of, même pattern que le reste
// du schéma).
const policiesSql = `
drop policy if exists "bilan_photos_storage_select" on storage.objects;
create policy "bilan_photos_storage_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'bilan-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_coach_of(((storage.foldername(name))[1])::uuid)
    )
  );

drop policy if exists "bilan_photos_storage_insert" on storage.objects;
create policy "bilan_photos_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'bilan-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_coach_of(((storage.foldername(name))[1])::uuid)
    )
  );

drop policy if exists "bilan_photos_storage_delete" on storage.objects;
create policy "bilan_photos_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'bilan-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_coach_of(((storage.foldername(name))[1])::uuid)
    )
  );
`;

const { error: sqlError } = await admin.rpc("exec_sql", { sql: policiesSql });
if (sqlError) throw sqlError;
console.log("Policies storage.objects appliquées.");
