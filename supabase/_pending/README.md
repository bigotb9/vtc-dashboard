# supabase/_pending/ — migrations DB préparées mais NON déployées

Ce dossier est **hors** du chemin de migration actif (`supabase/migrations/`).
**Aucun fichier ici n'est embarqué par `supabase db push`.** Il sert à parquer des
migrations rédigées et revues dont le déploiement attend une décision explicite.

## Contenu

- **`20260606000002_app_phase5_signaler.sql`** — feature « Signaler » de l'app
  chauffeur (tables/RPC `app_support_*`, `app_current_uid`, `app_dashboard_has_perm`,
  trigger, colonnes agent, seed `role_permissions`). Rédigée dans l'ex-repo mobile
  `app-drivers-fleet-boyahgroup`, **rapatriée ici le 12/06/2026**.
  **NON appliquée en prod** (vérifié en base : les objets `app_support_*` Phase 5
  n'existent pas ; seules Phase 2 + Phase 3 sont déployées).

  **Pour déployer** (quand la feature « Signaler » sera activée) : déplacer le fichier
  dans `supabase/migrations/` avec un timestamp **postérieur** à la baseline, puis
  `supabase db push`. Tant qu'il reste ici, il ne partira jamais accidentellement.
