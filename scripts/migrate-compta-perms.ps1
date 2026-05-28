# scripts/migrate-compta-perms.ps1
#
# Migration en lot : remplace tous les `requireDirecteurCompta(req)` dans
# app/api/compta/* par `requireComptaPermission(req, "<action>")` selon la
# méthode HTTP de la fonction qui contient l'appel + un mapping spécial pour
# les routes Exercices et Paramètres Société.
#
# Règles générales :
#   GET / HEAD                                -> view_comptabilite
#   POST / PATCH / PUT / DELETE (par défaut)  -> manage_comptabilite
#
# Mapping spécial (par chemin de fichier + méthode) :
#   exercices/route.ts        POST           -> manage_exercices
#   exercices/[id]/cloturer/  POST           -> manage_exercices
#   parametres-societe/route  PUT/PATCH/POST -> manage_societe
#   parametres-societe/logo/  POST/DELETE    -> manage_societe
#
# Cible aussi l'import : `import { requireDirecteurCompta }` -> `import { requireComptaPermission }`

$ErrorActionPreference = 'Stop'

# Normalise un chemin pour la table de mapping (forward slashes)
function NormPath([string]$p) {
    return ($p -replace '\\', '/')
}

$specialFiles = @{
    'app/api/compta/exercices/route.ts'              = @{ 'POST' = 'manage_exercices' }
    'app/api/compta/exercices/[id]/cloturer/route.ts' = @{ 'POST' = 'manage_exercices' }
    'app/api/compta/parametres-societe/route.ts'     = @{ 'PUT' = 'manage_societe'; 'PATCH' = 'manage_societe'; 'POST' = 'manage_societe' }
    'app/api/compta/parametres-societe/logo/route.ts' = @{ 'POST' = 'manage_societe'; 'DELETE' = 'manage_societe' }
}

$projectRoot = (Get-Location).Path
$files = @()
foreach ($f in (Get-ChildItem -Recurse -Path 'app/api/compta' -Filter '*.ts' -File)) {
    $txt = [System.IO.File]::ReadAllText($f.FullName)
    if ($txt -match 'requireDirecteurCompta') { $files += $f }
}

$report = @()
foreach ($file in $files) {
    $rel = NormPath($file.FullName.Substring($projectRoot.Length + 1))
    $content = [System.IO.File]::ReadAllText($file.FullName)

    # Détection des CRLF d'origine pour préserver
    $hadCrlf = $content.Contains("`r`n")
    $lines = $content -split "`r?`n"

    $currentMethod = $null
    $methodLineRegex = '^export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE|HEAD)\b'
    $callRegex       = 'await\s+requireDirecteurCompta\(req\)'
    $changes = @()

    for ($i = 0; $i -lt $lines.Length; $i++) {
        $line = $lines[$i]
        if ($line -match $methodLineRegex) {
            $currentMethod = $matches[1]
        }
        if ($line -match $callRegex) {
            $perm = $null
            if ($specialFiles.ContainsKey($rel) -and $specialFiles[$rel].ContainsKey($currentMethod)) {
                $perm = $specialFiles[$rel][$currentMethod]
            } elseif ($currentMethod -eq 'GET' -or $currentMethod -eq 'HEAD') {
                $perm = 'view_comptabilite'
            } else {
                $perm = 'manage_comptabilite'
            }
            $lines[$i] = $line -replace 'await\s+requireDirecteurCompta\(req\)', "await requireComptaPermission(req, `"$perm`")"
            $changes += "L$($i+1) [$currentMethod] -> $perm"
        }
    }

    # Remplacement de l'import
    $newContent = $lines -join $(if ($hadCrlf) { "`r`n" } else { "`n" })
    $newContent = $newContent -replace 'import\s*\{\s*requireDirecteurCompta\s*\}\s*from\s*"@/lib/compta/auth"', 'import { requireComptaPermission } from "@/lib/compta/auth"'

    # Écrire sans BOM
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($file.FullName, $newContent, $utf8NoBom)

    $report += [PSCustomObject]@{
        File    = $rel
        Changes = ($changes -join '; ')
    }
}

# Affichage synthétique
$report | Format-Table -AutoSize -Wrap
Write-Output "---"
Write-Output "Total fichiers migrés : $($report.Count)"

# Catégorisation finale
$callsByPerm = @{}
foreach ($r in $report) {
    foreach ($c in ($r.Changes -split '; ')) {
        if ($c -match '-> (\w+)$') {
            $p = $matches[1]
            if (-not $callsByPerm.ContainsKey($p)) { $callsByPerm[$p] = 0 }
            $callsByPerm[$p]++
        }
    }
}
Write-Output "Appels par permission :"
$callsByPerm.GetEnumerator() | Sort-Object Key | ForEach-Object { Write-Output ("  {0} : {1}" -f $_.Key, $_.Value) }
