# Plan de connexion réelle — session WAHA "lupi"

> **Statut : PRÉPARATION UNIQUEMENT. Rien de ce document n'a été exécuté.** Ce plan décrit
> comment *pourrait* se faire la connexion de whatsapp-sharp à la vraie session WAHA "lupi",
> avec un plan de test stagé et un garde-fou code désactivé par défaut. Suivre les phases
> ci-dessous reste une décision manuelle, prise étape par étape, avec Iskandeur au courant à
> chaque étape — ce document ne s'auto-exécute pas.

## 0. Ce qu'on connecterait, et pourquoi c'est sensible

whatsapp-sharp ne parle jamais directement à WhatsApp : il parle à une instance WAHA (l'API
HTTP qui pilote la session WhatsApp Web) via `WAHA_BASE_URL`/`WAHA_API_KEY`/`WAHA_SESSION`
(`.env.example`, `backend/src/config.ts`). Aujourd'hui, aucun déploiement de whatsapp-sharp ne
pointe vers une instance WAHA réelle — le déploiement public (`deploy/docker-compose.yml`) ne
configure même pas `WAHA_BASE_URL`.

Le VPS d'Iskandeur héberge déjà une instance WAHA de **production**, `deploy/docker-compose.waha.yml`
dans le dépôt de Lupi (pas ce dépôt) :

- conteneur `waha`, réseau Docker `deploy_default`, exposé à l'hôte uniquement
  (`127.0.0.1:3000`, pas à Internet) ;
- **deux sessions actives** : `lupi` (le numéro dédié de Lupi, celui que ce job doit préparer)
  et `default` (le **numéro personnel d'Iskandeur** — jamais celle-là) ;
- la session `lupi` est utilisée **en continu** par le daemon Lupi (`harness/`, process Node
  toujours allumé) via les outils MCP `whatsapp_lupi` — c'est le canal de communication
  principal Lupi↔Iskandeur.

Donc : connecter whatsapp-sharp à `lupi`, ce n'est pas connecter un service isolé à une
sandbox — c'est faire cohabiter **deux clients indépendants** sur la même session WhatsApp Web
en même temps. Le risque n'est pas seulement "whatsapp-sharp pourrait spammer" (le guard existant
couvre déjà ça très bien, voir README "Anti-detection guard"), il y a un second risque
spécifique à ce contexte : **la collision d'état avec le daemon**.

## 1. Architecture de connexion

### 1.1 Configuration (variables d'env, jamais en dur)

Toujours via `WAHA_BASE_URL` / `WAHA_API_KEY` / `WAHA_SESSION` (existant, `backend/src/config.ts`) :

```
WAHA_BASE_URL=http://127.0.0.1:3000   # ou http://waha:3000 si sur le même réseau docker — voir 1.3
WAHA_API_KEY=<clé — scoped si possible, voir 1.2>
WAHA_SESSION=lupi
```

### 1.2 Recommandation : une clé API *scoped* à la session `lupi`, pas la master key

WAHA expose une gestion de clés API scopées par session (`GET/POST /api/keys` — volontairement
**hors périmètre du code client** de whatsapp-sharp, `docs/waha-coverage.md` ligne 37 : "Infra/ops
concern, pas une feature de chat-client"). C'est exactement l'outil pour ce cas :

- Générer, **via le dashboard WAHA ou un `curl` manuel côté VPS** (pas depuis whatsapp-sharp),
  une clé API scopée à `session=lupi` uniquement.
- Cette clé, même si `WAHA_SESSION` était mal configuré ou si un bug pointait ailleurs, **ne
  peut pas authentifier un appel vers la session `default`** — c'est une garantie posée par WAHA
  lui-même, pas par notre code applicatif. Défense en profondeur : le garde-fou code (section 3)
  vérifie le nom de session *dans* l'appli, la clé scopée l'empêche *avant même* d'atteindre
  l'appli.
- Ne jamais utiliser la master `WAHA_API_KEY` (celle du dashboard, qui pilote les deux sessions)
  pour whatsapp-sharp.

### 1.3 Topologie réseau : ne PAS rejoindre `deploy_default`

`deploy/docker-compose.yml` (le déploiement whatsapp-sharp actuel) a un réseau `TUNNEL_NETWORK`
paramétrable, avec `deploy_default` comme valeur par défaut dans le fichier — mais le
déploiement effectivement en place (job #35, `memoire/vps.md`) utilise un réseau dédié à son
propre Quick Tunnel, **pas** `deploy_default`, précisément pour rester isolé des conteneurs de
prod. **Garder cet isolement** pour la connexion réelle : ne pas faire rejoindre
`deploy_default` (le réseau où vivent `waha`, `redis`, `cloudflared` de prod) au conteneur
whatsapp-sharp. À la place :

- pointer `WAHA_BASE_URL=http://127.0.0.1:3000` (le port déjà exposé à l'hôte) ;
- ajouter `extra_hosts: ["host.docker.internal:host-gateway"]` au service whatsapp-sharp dans
  `deploy/docker-compose.yml` (même pattern que `waha` lui-même dans
  `deploy/docker-compose.waha.yml`), et utiliser `WAHA_BASE_URL=http://host.docker.internal:3000`.

Ainsi whatsapp-sharp peut atteindre WAHA sans jamais être sur le même réseau Docker que les
conteneurs de production — un bug ou une compromission du conteneur whatsapp-sharp ne donne pas
un accès réseau direct à `redis`/`cloudflared`/`waha` par leur nom de service.

### 1.4 Risque de partage d'état avec le daemon — lecture seule d'abord

Le daemon Lupi tient la session `lupi` ouverte en continu (webhooks entrants, envois sortants).
whatsapp-sharp, s'il se connectait, serait un **second client WAHA** sur la même session. WAHA
lui-même n'a pas de verrou "un seul client à la fois" par session — plusieurs clients HTTP
peuvent interroger/écrire sur la même session sans erreur de son côté. Le risque n'est donc pas
un crash, mais un **effet de bord sur ce que voit ou déclenche le daemon** :

- une lecture (`chatsOverview`, `getMessages`, `getChatPicture`) ne change aucun état côté WAHA
  → **aucun risque d'interférence avec le daemon**, seulement une charge réseau/API
  supplémentaire négligeable ;
- `markChatRead`/`markChatUnread` **changent l'état "lu" côté WhatsApp** — si whatsapp-sharp
  marquait un message comme lu, le daemon (ou Iskandeur regardant son tél) verrait un message
  déjà lu qu'il n'a pas lu lui-même. Effet de bord réel, silencieux, confusant.
- `startTyping`/`subscribePresence` déclenchent un vrai indicateur "en train d'écrire" visible
  côté WhatsApp — pas dangereux en soi, mais visible et pourrait confondre Iskandeur s'il le
  voit sans que ce soit le daemon qui tape.
- `sendText` et toute action d'écriture **partagent le même canal de sortie que le daemon** —
  un message envoyé par whatsapp-sharp est indiscernable, pour Iskandeur, d'un message envoyé
  par Lupi. C'est le risque le plus sérieux, d'où la séquence phase 1 (lecture) → phase 2
  (écriture) plutôt qu'une bascule directe.

**Conséquence concrète pour le garde-fou (section 3) : phase 1 doit bloquer non seulement
`sendText`, mais TOUT appel qui n'est pas classé "read"** (donc aussi `markChatRead`,
`startTyping`, `subscribePresence`, réactions, etc.) — pas seulement les envois de message.
C'est ce que fait le flag implémenté (voir section 3) : il bloque par *kind* d'action
(`"read"` vs le reste), pas juste `sendText`.

## 2. Plan de test stagé — du plus sûr au plus risqué

Document à suivre manuellement, une phase à la fois, avec confirmation explicite d'Iskandeur
avant de passer à la phase suivante. Aucune de ces étapes n'a été exécutée par ce job.

### Phase a — Lecture seule

**Pré-requis** : `WAHA_REAL_CONNECTION=true`, `WAHA_REAL_CONNECTION_SESSION=lupi`,
`WAHA_REAL_CONNECTION_WRITE` **absent/false** (le défaut). Voir section 3 — avec cette
config, toute tentative d'appel non-lecture est refusée par le code lui-même (429 côté
frontend), pas seulement par discipline manuelle.

1. Lancer whatsapp-sharp en local (`npm run dev:backend` + `npm run dev:frontend`,
   `VITE_DEMO_MODE=false`) avec la config ci-dessus.
2. Dans l'UI : ouvrir la liste des chats, ouvrir un ou deux fils, faire défiler l'historique
   (pagination), regarder une photo de profil/chat.
3. **Pendant ce test, vérifier en parallèle que le daemon Lupi fonctionne normalement** :
   envoyer un message WhatsApp de test à Lupi depuis un autre téléphone/numéro et confirmer
   qu'il répond normalement (`journalctl -u lupi` pour voir le réveil sur webhook).
4. Vérifier `GET /api/guard/log` côté whatsapp-sharp : les appels doivent apparaître comme
   `read`, jamais `blocked` pour une raison autre que `real-connection-read-only` si on teste
   volontairement une action d'écriture depuis l'UI (bouton envoyer, marquer lu, etc. — ils
   doivent tous échouer en 429, c'est le comportement attendu de cette phase, pas un bug).
5. **Concluant si** : les données lues correspondent à la réalité (chats, messages, photos),
   zéro erreur WAHA inhabituelle, et le daemon n'a montré aucun comportement anormal pendant le
   test (pas de double-lecture de messages, pas de latence inhabituelle sur ses réponses).

### Phase b — Une seule action d'écriture, à faible risque et réversible

**Uniquement après feu vert explicite d'Iskandeur sur la phase a.**

**Pré-requis** : passer `WAHA_REAL_CONNECTION_WRITE=true` (deuxième flag distinct — voir
section 3, ce n'est pas automatique après la phase a).

1. Choisir une **réaction 👍** (`PUT /api/reaction` via `waha.setReaction`) sur un message de
   test — jamais un envoi de texte à ce stade.
2. Destinataire : un message envoyé **par Lupi lui-même, à lui-même** si possible (un chat où
   Lupi peut réagir à son propre message), ou à défaut un message d'Iskandeur **avec son accord
   explicite donné au moment du test** — jamais un tiers, jamais un chat de groupe.
3. Vérifier côté WhatsApp (téléphone) que la réaction apparaît, qu'elle est réversible (on peut
   la retirer), et qu'elle n'a rien déclenché d'inattendu côté daemon.
4. **Concluant si** : la réaction est passée, visible, réversible, sans erreur WAHA ni
   comportement anormal du daemon.

### Phase c — Envoi de message texte simple

**Uniquement après feu vert explicite d'Iskandeur sur la phase b.**

1. Envoyer **un seul** message texte court, à un destinataire de test sûr désigné par
   Iskandeur au moment du test (jamais un tiers, jamais un groupe).
2. Vérifier explicitement que le garde anti-détection (`sendGuarded` dans `waha-client.ts`)
   s'applique bien en connexion réelle : jitter avant l'envoi, indicateur "en train d'écrire"
   visible côté WhatsApp avant le message, entrée dans l'audit log (`GET /api/guard/log`) avec
   un `delayMs` non nul. **Vérifier qu'aucun bypass caché du mode mock ne subsiste** — à date,
   il n'y en a pas dans le code (`wahaFetch` est le seul point d'appel HTTP vers WAHA, aucun
   chemin ne le contourne, voir README "Anti-detection guard") ; le confirmer visuellement
   dans les logs suffit, pas de code à changer pour ça.
3. **Concluant si** : le message part, passe par le guard (délai + typing visibles), et
   `ack` progresse normalement (`ack:1` → `ack:2`, cf. `memoire/vps.md` — la distribution peut
   traîner ~10-15 min, ne pas paniquer si `ack:1` persiste quelques minutes).

### Phase d — Critères d'ARRÊT IMMÉDIAT (à toute phase)

Couper immédiatement (revenir `WAHA_REAL_CONNECTION=false`, ou simplement arrêter le process
whatsapp-sharp) si l'un de ces signaux apparaît, **à n'importe quelle phase** :

- toute erreur WAHA inhabituelle (5xx répétés, corps d'erreur inattendu) ;
- la session `lupi` passe à un état autre que `WORKING` (`SCAN_QR_CODE`, `FAILED`, etc.) — signe
  possible de déconnexion forcée ;
- tout signal de rate-limit ou de blocage venant de WAHA/WhatsApp lui-même (pas le guard
  applicatif — un vrai rejet côté WhatsApp) ;
- le daemon Lupi cesse de répondre normalement pendant/après le test ;
- toute action ou donnée inattendue apparaît côté WhatsApp (message non prévu, réaction non
  prévue, etc.).

Dans tous ces cas : **couper, documenter ce qui s'est passé (nouvelle entrée `memoire/`),
ne PAS retenter seul** — remonter à Iskandeur avant toute nouvelle tentative.

## 3. Garde-fou code (implémenté dans ce job, désactivé par défaut)

Voir `backend/src/real-connection-guard.ts` + son branchement dans `waha-client.ts`. Résumé :

- `WAHA_REAL_CONNECTION` (défaut : absent/false) — tant que ce n'est pas exactement `"true"`,
  **zéro changement de comportement** par rapport au code avant ce job.
- `WAHA_REAL_CONNECTION_SESSION` — quand le flag ci-dessus est actif, **chaque** appel WAHA
  vérifie que la session configurée (`WAHA_SESSION`) correspond exactement à cette valeur. Un
  mismatch fait échouer l'appel immédiatement (avant tout appel réseau), plutôt que de risquer
  d'atteindre une session non voulue par erreur de config.
- `WAHA_REAL_CONNECTION_WRITE` (défaut : absent/false) — deuxième flag, indépendant. Tant qu'il
  n'est pas `"true"`, tout appel WAHA qui n'est pas de type `"read"` (send, presence, group) est
  refusé avant d'atteindre WAHA. C'est ce qui rend la phase a (lecture seule) garantie par le
  code, pas seulement par discipline manuelle.
- Les deux flags sont **indépendants et cumulatifs** : passer en écriture nécessite d'avoir déjà
  `WAHA_REAL_CONNECTION=true` et le bon `WAHA_REAL_CONNECTION_SESSION` — impossible d'activer
  l'écriture "par erreur" sans avoir déjà délibérément activé la connexion réelle avec la bonne
  session.

## 4. Ce qui N'A PAS été fait dans ce job

- Aucun flag n'a été activé dans un environnement réel — `WAHA_REAL_CONNECTION` reste absent de
  tout déploiement existant.
- Aucun appel réseau n'a été fait vers l'instance WAHA de production.
- Aucun message, réaction, ou changement d'état n'a été envoyé sur WhatsApp.
- `deploy/docker-compose.yml` (le déploiement public actuel) n'a pas été modifié — la
  recommandation réseau (section 1.3) est documentée ici, pas appliquée.
- Aucune clé API scopée n'a été générée sur l'instance WAHA de production.

## 5. Réserves / doutes

- Le guard `sendGuarded` (jitter, typing, rate-limits) n'a **jamais été exercé contre une vraie
  instance WAHA** (README "Status/checkpoint" le dit déjà) — la phase c est donc aussi le tout
  premier test réel de ce guard, pas seulement du "real connection guard" ajouté ici. Bonne
  raison de garder la phase c pour la fin, avec quelqu'un qui regarde.
- Le "warm-up" du guard (`guard/config.ts`, `warmupPeriodMs`) se base sur l'heure de boot du
  process backend, pas sur l'état réel de la session WAHA (session `lupi` déjà chaude depuis
  longtemps côté daemon) — en connexion réelle, whatsapp-sharp appliquera des limites de
  warm-up "fraîches" alors que la session elle-même ne l'est pas. Probablement inoffensif (plus
  conservateur, pas moins), mais à noter.
- Deux clients WAHA actifs simultanément sur la même session est un scénario que ni WAHA ni ce
  guard n'ont été conçus/testés pour explicitement — le raisonnement de la section 1.4 est une
  analyse à froid du code, pas une vérification empirique. La phase a sert justement à vérifier
  ça en pratique avant d'aller plus loin.
