-- ============================================================
-- MIGRATION : Ajout du champ `code` aux tables caisses et comptes
-- Phase 3 Écran 1 — mapping logos fournisseurs de paiement
--
-- Idempotent (ADD COLUMN IF NOT EXISTS + UPDATE).
-- ============================================================

-- 1. Ajout du champ code (TEXT, nullable, pas d'index — usage simple lookup)
ALTER TABLE public.caisses ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.comptes ADD COLUMN IF NOT EXISTS code TEXT;

-- 2. Mapping caisses existantes (fixtures bootstrap Day 6)
UPDATE public.caisses SET code = 'wave'               WHERE libelle = 'Wave Boyah';
UPDATE public.caisses SET code = 'orange_money'       WHERE libelle = 'Orange Money Boyah';
UPDATE public.caisses SET code = 'mtn_momo'           WHERE libelle = 'MTN MoMo Boyah';
UPDATE public.caisses SET code = 'caisse_principale'  WHERE libelle = 'Caisse principale siège';
UPDATE public.caisses SET code = 'petite_caisse'      WHERE libelle = 'Petite caisse opérationnelle';

-- 3. Mapping comptes bancaires existants (fixtures bootstrap Day 6)
UPDATE public.comptes SET code = 'sgci'    WHERE libelle LIKE '%SGCI%';
UPDATE public.comptes SET code = 'ecobank' WHERE libelle LIKE '%Ecobank%';
UPDATE public.comptes SET code = 'nsia'    WHERE libelle LIKE '%NSIA%';

-- 4. Vérifications post-migration (à exécuter manuellement, commentées)
-- SELECT id, libelle, code FROM public.caisses ORDER BY libelle;
-- SELECT id, libelle, code FROM public.comptes ORDER BY libelle;
