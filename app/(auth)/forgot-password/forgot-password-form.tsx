"use client";

import { useActionState } from "react";
import Link from "next/link";

import { requestPasswordReset, type ResetRequestState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initialState: ResetRequestState = { error: null, success: false };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mot de passe oublié</CardTitle>
        <CardDescription>
          On t&apos;envoie un lien par email pour en choisir un nouveau.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state.success ? (
          <p className="rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground">
            Si un compte existe avec cet email, un lien de réinitialisation vient d&apos;être
            envoyé.
          </p>
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
            <Button type="submit" disabled={pending}>
              {pending ? "Envoi..." : "Envoyer le lien"}
            </Button>
          </form>
        )}
        <div className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="hover:text-foreground">
            ← Retour à la connexion
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
