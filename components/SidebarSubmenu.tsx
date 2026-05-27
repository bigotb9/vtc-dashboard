/**
 * @deprecated 24/05/2026 (v2 sidebar)
 *
 * Le panneau cascade "2 sidebars cote a cote" a ete remplace par un
 * accordeon vertical integre directement dans Sidebar.tsx (pattern
 * Boyah Transport). Ce fichier est conserve comme stub neutre pour
 * eviter de casser d'eventuels imports.
 *
 * A supprimer cote Windows (Emmanuel) si confirme.
 */

export function isComptaPath(p: string): boolean {
  return p === "/comptabilite" || p.startsWith("/comptabilite/")
}

export default function SidebarSubmenu(): null {
  return null
}
