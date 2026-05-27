# Logos fournisseurs de paiement — Module Comptabilité

Les fichiers `.svg` de ce dossier sont utilisés par le composant
`components/compta/CaisseLogo.tsx` pour afficher les logos officiels
des fournisseurs de paiement.

## État actuel : PLACEHOLDERS

⚠️ **Les logos fournis dans ce dossier sont des placeholders créés en interne**
(initiales colorées dans le style approchant l'identité de chaque marque).
Ils doivent être remplacés par les **logos officiels** téléchargés depuis les
sources ci-dessous avant mise en production.

## Sources officielles à télécharger

| Logo                | Source officielle                                                              | Format conseillé |
| ------------------- | ------------------------------------------------------------------------------ | ---------------- |
| `wave.svg`          | https://wave.com → footer → "Press kit" / "Brand assets"                       | SVG              |
| `orange-money.svg`  | https://www.orange.ci → "Espace presse" / "Identité de marque"                 | SVG              |
| `mtn-momo.svg`      | https://www.mtn.ci → footer → "Médias" / "Brand guidelines"                    | SVG              |
| `sgci.svg`          | https://www.societegenerale.ci → mentions légales ou Wikipedia (libre droit)   | SVG ou PNG       |
| `ecobank.svg`       | https://ecobank.com → press relations / brand assets                           | SVG ou PNG       |
| `nsia.svg`          | https://nsiabanque.com → contact presse                                        | SVG ou PNG       |

## Procédure de remplacement

1. Télécharger le logo officiel depuis la source.
2. Renommer le fichier exactement comme listé ci-dessus (kebab-case).
3. Remplacer le placeholder dans ce dossier.
4. Vérifier que le SVG s'affiche correctement dans la page `/comptabilite`
   sur les variantes de taille (xs/sm/md/lg) et en mode dark + light.
5. Vérifier les conditions de licence d'usage des marques :
    - Wave : usage compositionnel/référence autorisé sans altération du logo.
    - Orange / MTN : suivre les brand guidelines (ratio, marges, couleurs).
    - Banques (SGCI/Ecobank/NSIA) : usage non commercial / référence accepté
      en général ; en cas de doute, contacter le service marketing.

## Fallback automatique

Le composant `CaisseLogo` bascule **automatiquement** sur un fallback en
**initiales colorées** si :
- le fichier `.svg` est introuvable (404)
- le `caisse.code` n'est pas dans le registry

C'est pourquoi l'application reste fonctionnelle même sans logos téléchargés.
