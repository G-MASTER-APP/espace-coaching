import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

function buildNotice(params: { confirm?: string; reset?: string; error?: string }) {
  if (params.confirm) {
    return "Compte créé ! Vérifie tes emails pour confirmer ton adresse, puis connecte-toi.";
  }
  if (params.reset) {
    return "Mot de passe mis à jour, tu peux te connecter.";
  }
  if (params.error) {
    return "Le lien utilisé n'est plus valide, réessaie.";
  }
  return null;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ confirm?: string; reset?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  const params = await searchParams;

  return <LoginForm notice={buildNotice(params)} />;
}
