# Gouverner l'entreprise agentique — Depot participant

Bienvenue dans votre depot pour le seminaire **Gouverner l'entreprise agentique**.

Ce depot contient un **systeme agentique fonctionnel** que vous pouvez executer
immediatement, ainsi que des gabarits pour les exercices du seminaire.

## Demarrage rapide

```bash
npm install
cp .env.example .env
# Remplissez OPENAI_API_KEY et GMAIL_FROM dans .env

# Lancez le cas heureux (le courriel est envoye)
npm run demo:good_fit

# Lancez le cas risque (la gate bloque)
npm run demo:risky
```

## Ce que contient ce depot

### Systeme agentique fonctionnel

Le dossier `companies/` contient 3 entreprises pretes a l'emploi + 1 gabarit vide :

| Dossier | Description | Pret ? |
|---------|-------------|--------|
| `executive-education/` | Formation executive IA | Oui |
| `market-intelligence/` | Veille strategique | Oui |
| `growth-agency/` | Croissance B2B | Oui |
| `my-company/` | **Votre entreprise** (a remplir pendant le Bloc 3) | A faire |

Chaque entreprise est definie par 4 fichiers :
- `company_brief.md` -- description, clientele, proposition de valeur
- `pricing_rules.json` -- catalogue de services et regles de prix
- `approval_policy.json` -- seuils, actions interdites, regles de confidentialite
- `seed_inputs.json` -- leads de test (bon fit + risque)

### Workflow n8n

`workflow/founder_to_agentic_enterprise.json` -- importez-le dans n8n Cloud ou local.

Le workflow execute : recherche -> qualification -> offre -> brouillon courriel ->
gate de politique -> envoi ou escalade. Chaque etape ecrit dans `runtime/audit_log.jsonl`.

### Gate de politique

`scripts/policy_gate.ts` -- du code TypeScript deterministe qui decide si un
courriel peut etre envoye. Le meme code est copie dans le noeud Code de n8n.

### Exercices du seminaire

| Fichier | Bloc | Quoi |
|---------|------|------|
| `exercises/01-capability-map.md` | 1 | Carte des trois couches pour votre entreprise |
| `exercises/02-demo-notes.md` | 2 | Notes d'observation pendant les demos |
| `exercises/03-governance-onepager.md` | 3 | One-pager de gouvernance en 4 dimensions |

### Gabarits de gouvernance (YAML)

| Fichier | Quoi |
|---------|------|
| `governance/decision_rights.yaml` | Matrice de droits de decision |
| `governance/approval_thresholds.yaml` | Seuils d'approbation |

## Deroulement du seminaire

| Bloc | Duree | Ce que vous faites dans le repo |
|------|-------|-------------------------------|
| 1 -- Outils a agents | 60 min | Clonez le repo, `npm install`, remplissez `exercises/01-capability-map.md` |
| 2 -- Demos en direct | 60 min | Observez les demos, lancez `npm run demo:good_fit` et `npm run demo:risky` |
| 3 -- Gouvernance | 60 min | Remplissez `companies/my-company/*`, `exercises/03-governance-onepager.md`, lancez `npm run validate my-company` |

## Prerequis

- Node 18+
- Cle API OpenAI (`gpt-4o-mini`)
- Compte Gmail (le systeme envoie de vrais courriels a des boites que vous controlez)
- n8n Cloud ou local (optionnel pour les demos -- les scripts fonctionnent sans)

## Commandes utiles

| Commande | Description |
|----------|-------------|
| `npm run demo:good_fit` | Execute le cas heureux (executive-education) |
| `npm run demo:risky` | Execute le cas risque (growth-agency) |
| `npm run validate <pack>` | Valide un company pack |
| `npm run test:policy` | Teste la gate de politique |
| `npm run push:workflow` | Pousse le workflow vers n8n (API) |

## Documentation

- [docs/architecture.md](docs/architecture.md) -- architecture du systeme
- [docs/governance-model.md](docs/governance-model.md) -- modele de gouvernance
- [docs/live-demo-runbook.md](docs/live-demo-runbook.md) -- script minute par minute
- [docs/n8n-setup.md](docs/n8n-setup.md) -- guide n8n pas a pas
