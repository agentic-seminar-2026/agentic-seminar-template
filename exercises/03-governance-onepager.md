# One-pager de gouvernance

## Agent choisi

**Role de l'agent** : [ex: agent de prospection, agent de support, agent de recherche]
**Entreprise** : [nom de votre entreprise]

---

## 1. Droits de decision

Qui peut decider quoi ?

| Decision | Acteur autorise | Escalade si... |
|----------|----------------|----------------|
| [ex: Classifier un lead] | [Agent / Humain / Les deux] | [condition] |
| [ex: Envoyer un courriel] | | |
| [ex: Approuver un rabais] | | |
| [ex: Modifier une politique] | | |

## 2. Seuils d'approbation

Quand faut-il demander a un humain ?

| Metrique | Seuil agent autonome | Seuil superviseur | Seuil directeur |
|----------|---------------------|-------------------|-----------------|
| Montant financier | < [X]$ | [X]-[Y]$ | > [Y]$ |
| Nombre de destinataires | < [N] | [N]-[M] | > [M] |
| [Autre metrique] | | | |

## 3. Audit et auditabilite

Peut-on reconstituer ce qui s'est passe ?

- **Quoi journaliser** : [ex: chaque appel d'outil, chaque decision du LLM, chaque sortie envoyee]
- **Format** : [ex: JSONL, base de donnees, Notion]
- **Retention** : [ex: 12 mois minimum]
- **Acces** : [ex: equipe ops, DPO, conseil si necessaire]

## 4. Surveillance humaine

Qui remarque quand l'agent derive ?

- **Cadence de revue** : [ex: hebdomadaire, quotidienne]
- **Responsable** : [ex: ops lead, fondateur]
- **Alertes en temps reel** : [ex: anomalie de volume, score de confiance bas]
- **Signe d'alerte** : [ex: si personne ne lit les journaux depuis 2 semaines]

---

## Prochaine etape

Quel est le plus petit deploiement possible de cet agent avec cette gouvernance complete ?

[Votre reponse ici]
