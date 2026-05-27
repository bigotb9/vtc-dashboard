/**
 * /recettes-v2 — Vue unifiée des entrées (Phase 4.x Vague 3.5).
 *
 * Page Client (lecture URL state). Route alternative pendant le dev ; switch
 * sur /recettes après validation par Emmanuel (cf. spec §4.4).
 */

export const dynamic = "force-dynamic"

import { FlowPageClient } from "@/components/compta/depenses-recettes/FlowPageClient"

export default function RecettesV2Page() {
  return <FlowPageClient kind="recettes" />
}
