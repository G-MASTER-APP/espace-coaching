# G-MASTER — Espace Coaching

Web app mobile-first (PWA) pour le suivi coach ↔ client de G-MASTER.

## Stack

- **Next.js 16** (App Router, TypeScript, Turbopack en dev)
- **Tailwind CSS v4** (config CSS-first dans `app/globals.css`, palette G-MASTER)
- **shadcn/ui** (composants dans `components/ui`)
- **Supabase** (Postgres + Auth + Realtime), RLS stricte sur toutes les tables
- **Serwist** pour la PWA (service worker, installable sur téléphone)
- **Open Food Facts** pour la recherche d'aliments (journal diète)

## Lancer le projet en local

```bash
npm install
```

`.env.local` existe déjà avec les clés du projet Supabase. S'il manque, copier
`.env.local.example` et renseigner :

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  (Project Settings → API Keys sur supabase.com)
- `NEXT_PUBLIC_SITE_URL` (`http://localhost:3000` en local)

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

## Build de production

```bash
npm run build
npm run start
```

(Le build utilise `--webpack` : Serwist n'est pas encore compatible Turbopack
pour le build — le dev reste en Turbopack et est rapide.)

## Base de données : migrations

Le schéma complet vit dans `supabase/migrations/*.sql`, appliqué dans l'ordre.
Pour lancer une nouvelle migration sans repasser par le SQL Editor du
dashboard :

```bash
node scripts/run-migration.mjs .env.local supabase/migrations/000X_nom.sql
```

(Ça passe par une fonction `exec_sql` créée une fois dans le projet Supabase,
utilisable uniquement avec la clé service_role.)

Migrations existantes :

1. `0001_profiles.sql` — profils, rôles, rattachement coach/client
2. `0002_planning.sql` — planning hebdomadaire
3. `0003_programme.sql` — programme & vidéos
4. `0004_accompagnement.sql` — objectifs + suivi quotidien
5. `0005_bilan.sql` — mensurations
6. `0006_diete.sql` — objectifs nutritionnels, aliments, journal

## Déploiement (plus tard)

Pas fait pour l'instant (choix : rester en local). Le jour venu :

1. Pousser le repo sur GitHub.
2. Importer le projet sur [vercel.com](https://vercel.com).
3. Renseigner les variables d'environnement ci-dessus dans les settings Vercel
   (`NEXT_PUBLIC_SITE_URL` = l'URL de prod).
4. Mettre à jour Site URL / Redirect URLs dans Supabase Auth avec l'URL de prod.
5. Déployer — Vercel détecte Next.js automatiquement.

## Structure

```
app/
  (auth)/                  login, signup, forgot/reset password
  auth/confirm/             route de vérification des liens email Supabase
  api/food-search/          proxy serveur vers Open Food Facts
  dashboard/                liste des clients (coach)
  espace/[clientId]/        les 5 pages partagées coach/client
    layout.tsx               garde d'accès + bottom tab bar + switcher coach
    planning/ programme/ diete/ bilan/ accompagnement/
  icon.tsx, apple-icon.tsx  icônes PWA générées en code
  manifest.ts, sw.ts        PWA
lib/
  supabase/                 clients Supabase (browser / server)
  date/                     calcul semaine ISO / jour courant (Europe/Paris)
  nutrition.ts, body-zones.ts, video.ts   constantes/helpers métier
  use-debounced-callback.ts  autosave
components/ui/              composants shadcn/ui
supabase/migrations/        schéma SQL + RLS
proxy.ts                    rafraîchissement de session Supabase
```

## Resets automatiques

- **Planning** : nouvelle semaine = nouvelle ligne en base, calculée à la
  lecture (`lib/date/paris-week.ts`) à partir du lundi ISO en Europe/Paris.
  Aucun cron requis, l'historique de chaque semaine reste consultable en base.
- **Accompagnement** (suivi quotidien) et **Diète** (journal) : même principe
  avec `lib/date/paris-day.ts`, nouvelle ligne par jour. Les objectifs
  (cibles coach) ne sont jamais réinitialisés.

## Sécurité

RLS activée sur toutes les tables. Deux fonctions réutilisées partout :
`is_owner_or_coach(user_id)` (lecture/écriture client + son coach) et
`is_coach_of(user_id)` (écriture réservée au coach — objectifs, programme,
vidéos). Vérifié : un client ou un coach non rattaché ne peut lire aucune
donnée d'un autre compte (aucune ligne retournée).

## État d'avancement

- [x] Phase 1 — Socle
- [x] Phase 2 — Auth, rôles, dashboard coach
- [x] Phase 3 — Planning
- [x] Phase 4 — Programme & Vidéos
- [x] Phase 5 — Accompagnement
- [x] Phase 6 — Bilan
- [x] Phase 7 — Diète
- [ ] Phase 8 — Polish (déploiement, test sur mobile réel, réglages Auth
      restants — voir ci-dessous)

## Reste à faire côté Supabase (dashboard)

Ces réglages ne peuvent pas être faits depuis le code :

- **Authentication → URL Configuration** : Site URL = `http://localhost:3000`
  (à mettre à jour avec l'URL de prod au déploiement).
- **Authentication → Email Templates** ("Confirm signup" et "Reset Password") :
  lien du bouton = `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}&next={{ .RedirectTo }}`
