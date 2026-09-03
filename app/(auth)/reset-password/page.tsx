import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Nécessite la session "recovery" créée par le lien de /auth/confirm.
  if (!user) redirect("/login");

  return <ResetPasswordForm />;
}
