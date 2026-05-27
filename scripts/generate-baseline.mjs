#!/usr/bin/env node
/**
 * scripts/generate-baseline.mjs
 *
 * Genere supabase/migrations/00000000000000_legacy_baseline.sql contenant
 * le SQL exact pour recreer tout le schema public actuel (tables, vues,
 * triggers, fonctions, index, contraintes, RLS policies, comments).
 *
 * Strategie cle : pas de tri topologique des tables. On dump :
 *   - les tables avec uniquement PK + CHECK + defaults + NOT NULL (sans FK)
 *   - puis les FK separement en ALTER TABLE en fin de fichier
 *   - les vues triees par dependance (tri topologique de Kahn)
 *
 * Usage :
 *   $env:SUPABASE_DB_URL = "postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres"
 *   node scripts/generate-baseline.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"
import pg from "pg"

const OUTPUT_PATH = "supabase/migrations/00000000000000_legacy_baseline.sql"
const SCHEMA      = "public"

// ─────────────────────────────────────────────────────────────────────────────
// 0. CONNEXION
// ─────────────────────────────────────────────────────────────────────────────

if (!process.env.SUPABASE_DB_URL) {
  console.error("ERREUR : variable d'environnement SUPABASE_DB_URL non definie.")
  console.error("Exemple PowerShell :")
  console.error("  $env:SUPABASE_DB_URL = 'postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres'")
  process.exit(1)
}

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Quote double pour identifiants (preserve casse + caracteres speciaux). */
function q(name) {
  return `"${String(name).replace(/"/g, '""')}"`
}

/** Quote simple pour litteraux SQL (echappe les apostrophes). */
function qstr(s) {
  return `'${String(s).replace(/'/g, "''")}'`
}

/** Tri topologique de Kahn sur un Map<node, Set<dep>>. */
function topoSort(nodes, depsByNode) {
  // Copie les dependances pour pouvoir les muter
  const remaining = new Map()
  for (const n of nodes) {
    remaining.set(n, new Set(depsByNode.get(n) || []))
  }
  const sorted = []
  // Boucle jusqu'a ce qu'on ait tout traite ou qu'on detecte un cycle
  while (remaining.size > 0) {
    const ready = [...remaining.entries()]
      .filter(([, deps]) => deps.size === 0)
      .map(([n]) => n)
      .sort()  // ordre alphabetique stable
    if (ready.length === 0) {
      // Cycle : on append le reste en ordre alphabetique
      const rest = [...remaining.keys()].sort()
      console.warn(`[topoSort] cycle detecte sur : ${rest.join(", ")} — ordre alphabetique applique`)
      sorted.push(...rest)
      break
    }
    for (const n of ready) {
      sorted.push(n)
      remaining.delete(n)
      for (const [, deps] of remaining) deps.delete(n)
    }
  }
  return sorted
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. GENERATION
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  await client.connect()
  console.log("[1/13] Connexion DB OK")

  const sections = []
  const stats    = {}

  // ── Header ────────────────────────────────────────────────────────────────
  const ts = new Date().toISOString()
  sections.push(`-- ============================================================
-- Baseline schema public — generee le ${ts}
-- Source : scripts/generate-baseline.mjs
-- ============================================================
--
-- Ce fichier reconstruit l'integralite du schema public a partir
-- d'un dump du catalogue Postgres au moment de l'execution.
--
-- Sections :
--   1. Extensions
--   2. Types custom (enums, composites)
--   3. Sequences independantes
--   4. Tables (sans FK)
--   5. Indexes
--   6. UNIQUE constraints
--   7. Foreign Keys
--   8. Fonctions PL/pgSQL
--   9. Vues (ordre topologique)
--  10. Triggers
--  11. RLS policies
--  12. Comments
-- ============================================================

BEGIN;

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;`)

  // ── 1. EXTENSIONS ─────────────────────────────────────────────────────────
  sections.push("\n-- ── 1. EXTENSIONS ──────────────────────────────────────────")
  const ext = await client.query(`
    SELECT e.extname, n.nspname AS schema_name, e.extversion
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname NOT IN ('plpgsql')
    ORDER BY e.extname
  `)
  for (const r of ext.rows) {
    sections.push(`CREATE EXTENSION IF NOT EXISTS ${q(r.extname)} WITH SCHEMA ${q(r.schema_name)};`)
  }
  stats.extensions = ext.rows.length
  console.log(`[2/13] Extensions     : ${stats.extensions}`)

  // ── 2. TYPES CUSTOM ───────────────────────────────────────────────────────
  sections.push("\n-- ── 2. TYPES CUSTOM ────────────────────────────────────────")
  const types = await client.query(`
    SELECT t.oid, t.typname, t.typtype
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = $1
      AND t.typtype IN ('e', 'c')
      AND NOT EXISTS (SELECT 1 FROM pg_depend WHERE objid = t.oid AND deptype = 'e')
      AND t.typrelid = 0  -- exclure les composites crees implicitement par les tables
    ORDER BY t.typname
  `, [SCHEMA])
  for (const t of types.rows) {
    if (t.typtype === "e") {
      const labels = await client.query(
        `SELECT enumlabel FROM pg_enum WHERE enumtypid = $1 ORDER BY enumsortorder`,
        [t.oid]
      )
      const lits = labels.rows.map(r => qstr(r.enumlabel)).join(", ")
      sections.push(`CREATE TYPE ${SCHEMA}.${q(t.typname)} AS ENUM (${lits});`)
    } else if (t.typtype === "c") {
      const cols = await client.query(`
        SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS type_name
        FROM pg_attribute a
        JOIN pg_type t   ON t.typrelid = a.attrelid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = $1 AND n.nspname = $2
          AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY a.attnum
      `, [t.typname, SCHEMA])
      const def = cols.rows.map(c => `  ${q(c.attname)} ${c.type_name}`).join(",\n")
      sections.push(`CREATE TYPE ${SCHEMA}.${q(t.typname)} AS (\n${def}\n);`)
    }
  }
  stats.types = types.rows.length
  console.log(`[3/13] Types custom   : ${stats.types}`)

  // ── 3. SEQUENCES INDEPENDANTES ────────────────────────────────────────────
  sections.push("\n-- ── 3. SEQUENCES INDEPENDANTES ─────────────────────────────")
  // Sequences NON liees a une colonne SERIAL (owned by NONE)
  const seqs = await client.query(`
    SELECT c.relname AS seqname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'S'
      AND n.nspname = $1
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = c.oid AND d.deptype = 'a'
      )
    ORDER BY c.relname
  `, [SCHEMA])
  for (const s of seqs.rows) {
    sections.push(`CREATE SEQUENCE IF NOT EXISTS ${SCHEMA}.${q(s.seqname)};`)
  }
  stats.sequences = seqs.rows.length
  console.log(`[4/13] Sequences      : ${stats.sequences}`)

  // ── 4. TABLES (sans FK) ───────────────────────────────────────────────────
  sections.push("\n-- ── 4. TABLES ──────────────────────────────────────────────")
  const tables = await client.query(`
    SELECT c.oid, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = $1
      AND NOT EXISTS (SELECT 1 FROM pg_depend WHERE objid = c.oid AND deptype = 'e')
    ORDER BY c.relname
  `, [SCHEMA])

  for (const t of tables.rows) {
    const cols = await client.query(`
      SELECT
        a.attname,
        format_type(a.atttypid, a.atttypmod) AS type_name,
        a.attnotnull,
        pg_get_expr(d.adbin, d.adrelid)       AS default_expr,
        a.attidentity,
        a.attgenerated
      FROM pg_attribute a
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = $1 AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY a.attnum
    `, [t.oid])

    // PK et CHECK inline
    const cks = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) AS def, contype
      FROM pg_constraint
      WHERE conrelid = $1 AND contype IN ('p', 'c')
      ORDER BY contype DESC, conname  -- 'p' avant 'c'
    `, [t.oid])

    const colDefs = cols.rows.map(c => {
      let def = `  ${q(c.attname)} ${c.type_name}`
      if (c.attidentity === "a") {
        def += " GENERATED ALWAYS AS IDENTITY"
      } else if (c.attidentity === "d") {
        def += " GENERATED BY DEFAULT AS IDENTITY"
      } else if (c.attgenerated === "s") {
        def += ` GENERATED ALWAYS AS (${c.default_expr}) STORED`
      } else if (c.default_expr) {
        def += ` DEFAULT ${c.default_expr}`
      }
      if (c.attnotnull) def += " NOT NULL"
      return def
    })

    const conDefs = cks.rows.map(c => `  CONSTRAINT ${q(c.conname)} ${c.def}`)
    const body    = [...colDefs, ...conDefs].join(",\n")

    sections.push(`CREATE TABLE IF NOT EXISTS ${SCHEMA}.${q(t.relname)} (\n${body}\n);`)
  }
  stats.tables = tables.rows.length
  console.log(`[5/13] Tables         : ${stats.tables}`)

  // ── 5. INDEXES (hors PK / UNIQUE auto) ────────────────────────────────────
  sections.push("\n-- ── 5. INDEXES ─────────────────────────────────────────────")
  const indexes = await client.query(`
    SELECT
      c.relname             AS index_name,
      cl.relname            AS table_name,
      pg_get_indexdef(i.indexrelid) AS def
    FROM pg_index i
    JOIN pg_class c   ON c.oid  = i.indexrelid
    JOIN pg_class cl  ON cl.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1
      AND NOT i.indisprimary
      AND NOT EXISTS (
        -- Exclure les indexes lies a une constraint (UNIQUE / EXCLUDE)
        SELECT 1 FROM pg_depend d
        WHERE d.objid = i.indexrelid AND d.deptype = 'i'
      )
    ORDER BY cl.relname, c.relname
  `, [SCHEMA])
  for (const idx of indexes.rows) {
    // Convertir CREATE INDEX → CREATE INDEX IF NOT EXISTS
    const def = idx.def.replace(/^CREATE (UNIQUE )?INDEX /, "CREATE $1INDEX IF NOT EXISTS ")
    sections.push(`${def};`)
  }
  stats.indexes = indexes.rows.length
  console.log(`[6/13] Indexes        : ${stats.indexes}`)

  // ── 6. UNIQUE CONSTRAINTS ─────────────────────────────────────────────────
  sections.push("\n-- ── 6. UNIQUE CONSTRAINTS ──────────────────────────────────")
  const uniques = await client.query(`
    SELECT
      c.conname,
      cl.relname AS table_name,
      pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class cl    ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE c.contype = 'u'
      AND n.nspname = $1
    ORDER BY cl.relname, c.conname
  `, [SCHEMA])
  for (const u of uniques.rows) {
    sections.push(`ALTER TABLE ${SCHEMA}.${q(u.table_name)} ADD CONSTRAINT ${q(u.conname)} ${u.def};`)
  }
  stats.uniques = uniques.rows.length
  console.log(`[7/13] UNIQUE         : ${stats.uniques}`)

  // ── 7. FOREIGN KEYS ───────────────────────────────────────────────────────
  sections.push("\n-- ── 7. FOREIGN KEYS ────────────────────────────────────────")
  const fks = await client.query(`
    SELECT
      c.conname,
      cl.relname AS table_name,
      pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class cl    ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE c.contype = 'f'
      AND n.nspname = $1
    ORDER BY cl.relname, c.conname
  `, [SCHEMA])
  for (const f of fks.rows) {
    sections.push(`ALTER TABLE ${SCHEMA}.${q(f.table_name)} ADD CONSTRAINT ${q(f.conname)} ${f.def};`)
  }
  stats.fks = fks.rows.length
  console.log(`[8/13] Foreign Keys   : ${stats.fks}`)

  // ── 8. FONCTIONS PL/pgSQL ─────────────────────────────────────────────────
  sections.push("\n-- ── 8. FONCTIONS ───────────────────────────────────────────")
  const funcs = await client.query(`
    SELECT pg_get_functiondef(p.oid) AS def, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = $1
      AND p.prokind = 'f'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
    ORDER BY p.proname
  `, [SCHEMA])
  for (const f of funcs.rows) {
    // pg_get_functiondef retourne deja CREATE OR REPLACE FUNCTION ...
    sections.push(f.def.trim() + (f.def.trim().endsWith(";") ? "" : ";"))
  }
  stats.functions = funcs.rows.length
  console.log(`[9/13] Fonctions      : ${stats.functions}`)

  // ── 9. VUES (ordre topologique) ───────────────────────────────────────────
  sections.push("\n-- ── 9. VUES ────────────────────────────────────────────────")
  const views = await client.query(`
    SELECT c.oid, c.relname, c.relkind, pg_get_viewdef(c.oid, true) AS def
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('v', 'm')
      AND n.nspname = $1
    ORDER BY c.relname
  `, [SCHEMA])

  // Dependances vue→vue
  const viewDeps = await client.query(`
    SELECT DISTINCT src.relname AS src, tgt.relname AS tgt
    FROM pg_depend d
    JOIN pg_rewrite r   ON r.oid = d.objid
    JOIN pg_class src   ON src.oid = r.ev_class
    JOIN pg_class tgt   ON tgt.oid = d.refobjid
    JOIN pg_namespace ns ON ns.oid = src.relnamespace
    JOIN pg_namespace nt ON nt.oid = tgt.relnamespace
    WHERE ns.nspname = $1 AND nt.nspname = $1
      AND src.oid <> tgt.oid
      AND src.relkind IN ('v', 'm')
      AND tgt.relkind IN ('v', 'm')
  `, [SCHEMA])

  // Construire le graphe : pour chaque vue, l'ensemble des vues qu'elle utilise
  const viewNames = views.rows.map(v => v.relname)
  const depsByView = new Map(viewNames.map(n => [n, new Set()]))
  for (const dep of viewDeps.rows) {
    if (depsByView.has(dep.src)) depsByView.get(dep.src).add(dep.tgt)
  }
  const sortedViews = topoSort(viewNames, depsByView)
  const viewByName  = new Map(views.rows.map(v => [v.relname, v]))

  for (const name of sortedViews) {
    const v = viewByName.get(name)
    if (!v) continue
    const isMatView = v.relkind === "m"
    const kw        = isMatView ? "MATERIALIZED VIEW" : "VIEW"
    sections.push(`DROP ${kw} IF EXISTS ${SCHEMA}.${q(name)} CASCADE;`)
    const cleanDef = v.def.trim().replace(/;$/, "")
    sections.push(`CREATE ${kw} ${SCHEMA}.${q(name)} AS\n${cleanDef};`)
  }
  stats.views = views.rows.length
  console.log(`[10/13] Vues          : ${stats.views}`)

  // ── 10. TRIGGERS ──────────────────────────────────────────────────────────
  sections.push("\n-- ── 10. TRIGGERS ───────────────────────────────────────────")
  const triggers = await client.query(`
    SELECT
      t.tgname,
      cl.relname AS table_name,
      pg_get_triggerdef(t.oid) AS def
    FROM pg_trigger t
    JOIN pg_class cl    ON cl.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE NOT t.tgisinternal
      AND n.nspname = $1
    ORDER BY cl.relname, t.tgname
  `, [SCHEMA])
  for (const tg of triggers.rows) {
    sections.push(`DROP TRIGGER IF EXISTS ${q(tg.tgname)} ON ${SCHEMA}.${q(tg.table_name)};`)
    sections.push(`${tg.def};`)
  }
  stats.triggers = triggers.rows.length
  console.log(`[11/13] Triggers      : ${stats.triggers}`)

  // ── 11. RLS POLICIES ──────────────────────────────────────────────────────
  sections.push("\n-- ── 11. RLS POLICIES ───────────────────────────────────────")
  // Activation RLS
  const rlsTables = await client.query(`
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r' AND n.nspname = $1 AND c.relrowsecurity = true
    ORDER BY c.relname
  `, [SCHEMA])
  for (const t of rlsTables.rows) {
    sections.push(`ALTER TABLE ${SCHEMA}.${q(t.relname)} ENABLE ROW LEVEL SECURITY;`)
  }
  stats.rlsTables = rlsTables.rows.length

  // Policies
  const policies = await client.query(`
    SELECT
      schemaname, tablename, policyname,
      permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = $1
    ORDER BY tablename, policyname
  `, [SCHEMA])
  for (const p of policies.rows) {
    const rolesArr = Array.isArray(p.roles) ? p.roles : [p.roles]
    const roles    = rolesArr.join(", ")
    let stmt       = `CREATE POLICY ${q(p.policyname)} ON ${SCHEMA}.${q(p.tablename)}`
    stmt          += ` AS ${p.permissive}`
    stmt          += ` FOR ${p.cmd}`
    stmt          += ` TO ${roles}`
    if (p.qual)       stmt += ` USING (${p.qual})`
    if (p.with_check) stmt += ` WITH CHECK (${p.with_check})`
    stmt          += ";"
    sections.push(stmt)
  }
  stats.policies = policies.rows.length
  console.log(`[12/13] RLS policies  : ${stats.policies} (sur ${stats.rlsTables} table(s) RLS-enabled)`)

  // ── 12. COMMENTS ──────────────────────────────────────────────────────────
  sections.push("\n-- ── 12. COMMENTS ───────────────────────────────────────────")
  const tableComments = await client.query(`
    SELECT c.relname, c.relkind, d.description
    FROM pg_class c
    JOIN pg_namespace n   ON n.oid = c.relnamespace
    JOIN pg_description d ON d.objoid = c.oid AND d.objsubid = 0
    WHERE n.nspname = $1
      AND c.relkind IN ('r', 'v', 'm')
    ORDER BY c.relname
  `, [SCHEMA])
  for (const c of tableComments.rows) {
    const obj = c.relkind === "v" ? "VIEW"
              : c.relkind === "m" ? "MATERIALIZED VIEW"
              : "TABLE"
    sections.push(`COMMENT ON ${obj} ${SCHEMA}.${q(c.relname)} IS ${qstr(c.description)};`)
  }

  const colComments = await client.query(`
    SELECT c.relname, a.attname, d.description
    FROM pg_class c
    JOIN pg_namespace n   ON n.oid = c.relnamespace
    JOIN pg_attribute a   ON a.attrelid = c.oid
    JOIN pg_description d ON d.objoid = c.oid AND d.objsubid = a.attnum
    WHERE n.nspname = $1
      AND c.relkind IN ('r', 'v', 'm')
      AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY c.relname, a.attnum
  `, [SCHEMA])
  for (const c of colComments.rows) {
    sections.push(`COMMENT ON COLUMN ${SCHEMA}.${q(c.relname)}.${q(c.attname)} IS ${qstr(c.description)};`)
  }
  stats.comments = tableComments.rows.length + colComments.rows.length
  console.log(`[13/13] Comments      : ${stats.comments}`)

  // ── Footer ────────────────────────────────────────────────────────────────
  sections.push("\nCOMMIT;\n")

  // ── Ecriture du fichier ──────────────────────────────────────────────────
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
  const finalSql = sections.join("\n")
  writeFileSync(OUTPUT_PATH, finalSql, "utf8")

  await client.end()

  // ── Recap console ────────────────────────────────────────────────────────
  console.log("")
  console.log(`✅ Baseline generee → ${OUTPUT_PATH}`)
  console.log(`   Extensions      : ${stats.extensions}`)
  console.log(`   Types custom    : ${stats.types}`)
  console.log(`   Sequences indep : ${stats.sequences}`)
  console.log(`   Tables          : ${stats.tables}`)
  console.log(`   Indexes         : ${stats.indexes}`)
  console.log(`   UNIQUE          : ${stats.uniques}`)
  console.log(`   Foreign Keys    : ${stats.fks}`)
  console.log(`   Fonctions       : ${stats.functions}`)
  console.log(`   Vues            : ${stats.views}`)
  console.log(`   Triggers        : ${stats.triggers}`)
  console.log(`   RLS policies    : ${stats.policies} (sur ${stats.rlsTables} table(s))`)
  console.log(`   Comments        : ${stats.comments}`)
  console.log(`   Taille          : ${(finalSql.length / 1024).toFixed(1)} KB`)
}

main().catch(err => {
  console.error("ERREUR :", err)
  process.exit(1)
})
