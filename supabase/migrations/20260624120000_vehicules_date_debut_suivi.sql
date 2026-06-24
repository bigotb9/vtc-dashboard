-- ============================================================
-- vehicules.date_debut_suivi — borne de début du suivi des recettes
-- 24/06/2026
-- ============================================================
-- Problème : le suivi des versements (calculCompletude + BoyahBot) bornait
-- le "pre_service" sur la date de la 1ère ATTRIBUTION du véhicule. Un véhicule
-- sans aucune attribution (nouvelles voitures au garage : 14/15/16) n'était
-- jamais borné → tous les jours de la fenêtre comptés "manquant" → impayés
-- fantômes, y compris AVANT l'entrée du véhicule.
--
-- Décision métier (Emmanuel) : le suivi d'un véhicule commence à sa
-- date_debut_suivi. Tout jour antérieur = hors flotte (pre_service), jamais
-- attendu. Défaut = date de la 1ère affectation (Emmanuel affecte un chauffeur
-- à l'enregistrement). Modifiable (repousser pour un véhicule pas encore en
-- service). NULL = pas de suivi (fail-safe : rien attendu).
--
-- Idempotent : ADD COLUMN IF NOT EXISTS, backfill WHERE NULL,
-- CREATE OR REPLACE FUNCTION + DROP/CREATE TRIGGER.
-- ============================================================

BEGIN;

-- ── 1. Colonne ─────────────────────────────────────────────────────────────
ALTER TABLE public.vehicules
  ADD COLUMN IF NOT EXISTS date_debut_suivi date;

COMMENT ON COLUMN public.vehicules.date_debut_suivi IS
  'Début du suivi des recettes. Aucune recette attendue avant cette date (jours antérieurs = pre_service / hors flotte). Défaut = date de la 1ère affectation. NULL = pas de suivi (fail-safe). Modifiable (repousser pour un véhicule au garage). Ajouté le 24/06/2026.';

-- ── 2. Backfill = MIN(date_debut) de la 1ère affectation ───────────────────
-- WHERE date_debut_suivi IS NULL → ré-exécutable sans écraser un override.
UPDATE public.vehicules v
   SET date_debut_suivi = sub.min_debut
  FROM (
    SELECT id_vehicule, MIN(date_debut) AS min_debut
      FROM public.affectation_chauffeurs_vehicules
     WHERE date_debut IS NOT NULL
     GROUP BY id_vehicule
  ) sub
 WHERE v.id_vehicule = sub.id_vehicule
   AND v.date_debut_suivi IS NULL;

-- ── 3. Trigger : auto-remplissage à la 1ère affectation ────────────────────
-- Pour les nouveaux véhicules : quand on crée l'affectation du chauffeur,
-- date_debut_suivi se remplit avec date_debut SI elle est encore NULL.
-- N'écrase JAMAIS une valeur existante (préserve le backfill et les overrides).
CREATE OR REPLACE FUNCTION public.set_date_debut_suivi_on_affectation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $FUNC$
BEGIN
  IF NEW.date_debut IS NOT NULL THEN
    UPDATE public.vehicules
       SET date_debut_suivi = NEW.date_debut
     WHERE id_vehicule = NEW.id_vehicule
       AND date_debut_suivi IS NULL;
  END IF;
  RETURN NEW;
END;
$FUNC$;

COMMENT ON FUNCTION public.set_date_debut_suivi_on_affectation IS
  'À l''INSERT d''une affectation, renseigne vehicules.date_debut_suivi = date_debut SI encore NULL (jamais d''écrasement). Défaut métier de la borne du suivi des recettes. Ajouté le 24/06/2026.';

REVOKE ALL ON FUNCTION public.set_date_debut_suivi_on_affectation FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_date_debut_suivi_on_affectation TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_set_date_debut_suivi ON public.affectation_chauffeurs_vehicules;
CREATE TRIGGER trg_set_date_debut_suivi
  AFTER INSERT ON public.affectation_chauffeurs_vehicules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_date_debut_suivi_on_affectation();

-- ── 4. Override : véhicules au garage (pas encore en service) ───────────────
-- 14/15/16 affectés les 9-11/06 mais non roulants → suivi à partir du 24/06.
UPDATE public.vehicules
   SET date_debut_suivi = '2026-06-24'
 WHERE id_vehicule IN (14, 15, 16);

COMMIT;

-- Vérification post-application (à exécuter après le COMMIT) :
--   SELECT id_vehicule, immatriculation, date_debut_suivi
--     FROM public.vehicules ORDER BY id_vehicule;
-- Attendu : 13 lignes renseignées ; 14/15/16 = 2026-06-24.
