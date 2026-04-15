# SkillSwap — Prototype Projet Gestion de projets

![Backend Tests](https://github.com/machiavels/skillswap/actions/workflows/ci.yml/badge.svg)

SkillSwap est une application mobile permettant à des utilisateurs jeunes d'échanger des compétences entre pairs selon un système de crédits-temps. Chaque échange est valorisé par une unité de crédit : l'enseignant(e) en reçoit une, l'apprenant(e) en perd une.

## Architecture technique

| Couche | Technologie |
|---|---|
| Application mobile | React Native + Expo |
| API REST | Node.js + Express |
| Base de données | PostgreSQL 16 |
| Temps réel | Socket.io (authentification JWT) |
| Authentification | JWT avec rotation des jetons de rafraîchissement |

## Mise en route

```bash
git clone https://github.com/machiavels/skillswap.git
cd skillswap
cp backend/.env.example backend/.env   # renseigner JWT_SECRET et DB_PASSWORD
docker compose up -d
docker compose exec backend npm run migrate
docker compose exec backend npm run seed
```

## Référence de l'API

### Authentification

| Méthode | Chemin | Description |
|---|---|---|
| POST | /api/v1/auth/register | Inscription (âge minimum 15 ans, acceptation des CGU requise) |
| POST | /api/v1/auth/login | Connexion |
| POST | /api/v1/auth/refresh | Rotation du jeton de rafraîchissement |
| POST | /api/v1/auth/logout | Révocation du jeton de rafraîchissement |

### Profil

| Méthode | Chemin | Description |
|---|---|---|
| GET | /api/v1/profile/me | Consultation du profil personnel |
| GET | /api/v1/profile/:userId | Consultation du profil public d'un utilisateur |
| PUT | /api/v1/profile/me | Modification du profil et téléversement de la photo |

### Compétences

| Méthode | Chemin | Description |
|---|---|---|
| GET | /api/v1/skills | Liste des compétences référentielles (paramètres : q, category) |
| GET | /api/v1/skills/me | Compétences de l'utilisateur connecté |
| POST | /api/v1/skills/me | Ajout ou mise à jour d'une compétence |
| DELETE | /api/v1/skills/me/:id | Suppression d'une compétence |
| GET | /api/v1/skills/user/:userId | Compétences d'un utilisateur quelconque |

### Disponibilités

| Méthode | Chemin | Description |
|---|---|---|
| GET | /api/v1/availabilities/me | Créneaux de l'utilisateur connecté |
| PUT | /api/v1/availabilities/me | Remplacement complet des créneaux |
| GET | /api/v1/availabilities/:userId | Créneaux d'un utilisateur quelconque |

### Recherche

| Méthode | Chemin | Description |
|---|---|---|
| GET | /api/v1/search/users | Recherche d'utilisateurs par compétence, avec pagination |

### Échanges

| Méthode | Chemin | Description |
|---|---|---|
| POST | /api/v1/exchanges | Création d'une demande d'échange |
| GET | /api/v1/exchanges | Liste des échanges (paramètres : status, role) |
| GET | /api/v1/exchanges/:id | Consultation d'un échange |
| PATCH | /api/v1/exchanges/:id/respond | Acceptation ou annulation (action : accept, cancel) |
| PATCH | /api/v1/exchanges/:id/confirm | Confirmation de réalisation (les deux parties requises) |

### Messagerie

| Méthode | Chemin | Description |
|---|---|---|
| GET | /api/v1/exchanges/:id/messages | Historique des messages (pagination par curseur) |
| POST | /api/v1/exchanges/:id/messages | Envoi d'un message (point de repli REST) |

### Évaluations

| Méthode | Chemin | Description |
|---|---|---|
| POST | /api/v1/exchanges/:id/reviews | Soumission d'une évaluation (uniquement après complétion) |
| GET | /api/v1/users/:userId/reviews | Liste des évaluations reçues par un utilisateur |

### Notifications

| Méthode | Chemin | Description |
|---|---|---|
| GET | /api/v1/notifications | Liste des notifications de l'utilisateur connecté (pagination, unread count) |
| PATCH | /api/v1/notifications/:id/read | Marquer une notification comme lue |
| PATCH | /api/v1/notifications/read-all | Marquer toutes les notifications comme lues |
| POST | /api/v1/notifications/push-token | Enregistrer ou mettre à jour le token Expo Push |

Les notifications sont également émises en temps réel via Socket.io dans la salle personnelle `user:<id>`, sur l'événement `notification`.

Types de notifications : `exchange_request`, `exchange_accepted`, `exchange_cancelled`, `exchange_completed`, `new_message`, `new_review`.

### Signalements (utilisateurs)

| Méthode | Chemin | Description |
|---|---|---|
| POST | /api/v1/reports | Signaler un utilisateur, un échange ou un message (limité à 5/jour) |

### Administration

> Toutes les routes `/admin` nécessitent un compte avec `role = 'admin'`.

#### Analytics

| Méthode | Chemin | Description |
|---|---|---|
| GET | /api/v1/admin/analytics/overview | Vue d'ensemble de la plateforme (utilisateurs, échanges, notes) |
| GET | /api/v1/admin/analytics/exchange-volume | Volume journalier d'échanges par statut (filtres ?from, ?to) |
| GET | /api/v1/admin/analytics/popular-skills | Top 20 des compétences les plus demandées |
| GET | /api/v1/admin/analytics/user-retention | Inscriptions hebdomadaires |

#### Modération

| Méthode | Chemin | Description |
|---|---|---|
| GET | /api/v1/admin/reports | Lister les signalements (filtres ?status, ?target_type) |
| PATCH | /api/v1/admin/reports/:id | Résoudre un signalement (reviewed ou dismissed) |
| DELETE | /api/v1/admin/users/:userId | Suppression logique d'un utilisateur + révocation des tokens |
| DELETE | /api/v1/admin/exchanges/:id | Suppression logique d'un échange |

Documentation complète de l'API admin : [`docs/admin-api.md`](docs/admin-api.md)

## Événements Socket.io

```
Connexion : { auth: { token: "<jeton d'accès JWT>" } }

Client vers serveur :
  join_exchange   { exchangeId }           — rejoindre la salle de discussion
  send_message    { exchangeId, content }  — envoyer un message
  typing          { exchangeId }           — diffuser un indicateur de saisie

Serveur vers client :
  joined_exchange { exchangeId }
  new_message     { id, content, created_at, sender: { id, pseudo } }
  partner_typing  { userId, pseudo }
  notification    { id, type, payload, created_at }  — notification temps réel
  error           { message }
```

## Logique métier

### Score de compatibilité (0 à 100)

| Dimension | Points max | Règle de calcul |
|---|---|---|
| Adéquation des niveaux | 40 | Identique = 40, écart de 1 = 30, écart de 2 = 15, écart de 3 ou plus = 5 |
| Disponibilités communes | 30 | 3 points par jour commun, plafonné à 10 jours |
| Note du partenaire | 20 | Normalisation de 1-5 vers 0-20 |
| Expérience du partenaire | 10 | 1 point par échange réalisé, plafonné à 10 |

### Système de crédits

- Chaque utilisateur dispose à l'inscription d'un solde initial de 2 crédits.
- La création d'une demande d'échange requiert un solde d'au moins 1 crédit.
- À la complétion d'un échange : l'enseignant reçoit 1 crédit, l'apprenant en cède 1 (plancher à 0).

### Cycle de vie d'un échange

```
en_attente → accepté → [confirmation des deux parties] → complété
          └→ annulé (l'une ou l'autre partie)
```

### Suppression logique (soft-delete)

Les utilisateurs, échanges et messages ne sont jamais supprimés physiquement. Un champ `deleted_at` est positionné. Un utilisateur supprimé voit ses tokens révoqués et ne peut plus se connecter (401). Toutes les listes filtrent automatiquement `WHERE deleted_at IS NULL`.

## Tests

```bash
cd backend
npm test          # Jest + Supertest, base de données de test isolée
npm run coverage  # rapport de couverture
```

La CI GitHub Actions (`.github/workflows/ci.yml`) exécute les tests et la couverture à chaque push et pull request.

## Avancement

### MVP (Sprints 1–4)
- [x] Sprint 1 — Authentification et profil
- [x] Sprint 2 — Compétences, disponibilités et recherche
- [x] Sprint 3 — Échanges, score de compatibilité et messagerie temps réel
- [x] Sprint 4 — Crédits, évaluations et historique

### Post-MVP
- [x] Issue #6 — Système de notifications (in-app + Expo Push)
- [x] Issue #7 — Analytics admin (volume, compétences populaires, rétention)
- [x] Issue #8 — Outils de modération (signalements, soft-delete, révocation)
