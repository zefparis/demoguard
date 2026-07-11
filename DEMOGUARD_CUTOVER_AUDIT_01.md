# DEMOGUARD_CUTOVER_AUDIT_01 — Audit avant bascule vers demoguard-app

**Date :** 11 juillet 2026
**Objectif :** Bascule de `payguard/demoguard` vers `demoguard-app` (client standalone)
**Contrainte :** Lecture seule. Aucune modification. hybrid-vector-api et hcs-u7-backend ne doivent être modifiés QUE si l'investigation prouve un blocage réel.

---

## 1. RÉFÉRENCES CROISÉES — qui pointe vers l'ancien DemoGuard ?

### 1.1 Recherche exhaustive

| Repo | Fichier:ligne | Usage | Action requise |
|------|--------------|-------|----------------|
| **hcs-u7-backend** | `src/routes/cognitive-sse.routes.ts:704` | `process.env.DEMOGUARD_URL \|\| 'https://payguard-one.vercel.app/demoguard'` — fallback hardcoded vers l'ancien domaine | Changer la valeur de l'env var `DEMOGUARD_URL` sur Render (point vers la nouvelle URL demoguard-app). Le fallback hardcoded est un filet de sécurité — peut rester ou être mis à jour. |
| **hcs-u7-backend** | `src/routes/cognitive-sse.routes.ts:705` | `demoGuardUrl = ${demoGuardBaseUrl}?sessionPublicId=...` — génération de l'URL DemoGuard pour le Cognitive Terminal | Rien (le format `?sessionPublicId=` est déjà compatible avec demoguard-app si on ajoute la lecture du query param — voir §2c) |
| **hcs-u7-admin** | `app/(admin)/cognitive-terminal/page.tsx:91` | `demoGuardUrl` state — stocke l'URL retournée par le backend | Rien (l'admin reçoit l'URL du backend, ne la génère pas) |
| **hcs-u7-admin** | `app/(admin)/cognitive-terminal/page.tsx:380` | `setDemoGuardUrl(data.demoGuardUrl \|\| null)` — réception de l'URL depuis l'API | Rien |
| **hcs-u7-admin** | `app/(admin)/cognitive-terminal/page.tsx:396-398` | `handleOpenDemoGuard` — `window.open(demoGuardUrl, '_blank')` — bouton "Open DemoGuard" | Rien (ouvre l'URL fournie par le backend) |
| **hcs-u7-admin** | `app/api/cognitive-terminal/demo-session/create/route.ts:40` | Proxy vers `POST /api/cognitive-profile/demo-session` du backend | Rien |
| **payguard** | `.env.local:3` | `VITE_API_URL="https://payguard-one.vercel.app/api"` | Rien (payguard reste tel quel pour l'instant) |
| **payguard** | `.env.production.example:19` | `PAYGUARD_ALLOWED_ORIGINS=https://payguard.vercel.app,...` | Rien (payguard reste tel quel) |
| **payguard** | `src/constants/routes.ts:6` | `DEMOGUARD: '/demoguard'` — route interne payguard | Rien (à retirer plus tard, PAS maintenant) |
| **payguard** | `src/App.tsx:27` | `<Route path={ROUTES.DEMOGUARD} element={...}>` — route React | Rien (à retirer plus tard) |
| **payguard** | `src/pages/DemoGuard.tsx:217-227` | `useSearchParams()` + `searchParams.get('sessionPublicId')` — lecture du query param avec validation regex `hcs_sess_` | Rien (legacy, reste en place) |
| **payguard** | `api/demoguard/verify.ts` | Proxy Vercel serverless pour `/api/demoguard/verify` | Rien (legacy, reste en place) |
| **hcs-u7-proxy** | — | Aucune référence à `demoguard`, `payguard`, ou `payguard-one.vercel.app` | Rien — confirmé hors chaîne DemoGuard |
| **hybrid-vector-api** | `src/routes/demoguard.ts` | Route `/demoguard/verify` — auth par `X-API-Key` uniquement | Rien |
| **hybrid-vector-api** | `src/services/hcsMonitoringRecorder.ts:19` | `source: 'demoguard'` — type littéral dans l'interface | Rien (la source est forcée côté proxy, pas par le client) |
| **hybrid-vector-api** | `src/services/demoguardFusionTrigger.ts` | Multiples références `source: 'demoguard_mobile'` dans les events | Rien (forcé par le proxy Vercel, pas par le client) |

### 1.2 Focus hcs-u7-admin — Cognitive Terminal

**Bouton "Open DemoGuard" :**
- Localisé : `app/(admin)/cognitive-terminal/page.tsx:396-398` (`handleOpenDemoGuard`)
- L'URL n'est **PAS** en dur ni en env var côté admin. Elle est **retournée par le backend** via `POST /api/cognitive-profile/demo-session`.
- Le backend construit l'URL avec `process.env.DEMOGUARD_URL` (fallback `https://payguard-one.vercel.app/demoguard`).
- **L'env var `DEMOGUARD_URL` est le seul point de contrôle.** Elle est sur Render (hcs-u7-backend).

**Autres endroits de l'admin générérant/affichant une URL DemoGuard :**
- Aucun autre endroit trouvé. Le `demoGuardUrl` state est uniquement peuplé par la réponse du backend et affiché via le bouton "Open DemoGuard" + texte "DemoGuard URL ready".

---

## 2. CONTRAT SESSION — sessionPublicId

### 2a) Côté admin — création de session

- **Endpoint :** `POST /api/cognitive-profile/demo-session` (backend `cognitive-sse.routes.ts:647`)
- **Auth :** `X-Worker-Auth` / API key / JWT
- **Flow :**
  1. Génère `demoTenantId = 'demo_' + crypto.randomBytes(8).toString('hex')`
  2. Génère `demoSessionToken = crypto.randomBytes(32).toString('hex')`
  3. `sessionPublicId = deriveSessionPublicId(demoTenantId, demoSessionToken)` → format `hcs_sess_<16 base64url chars>`
  4. `expiresAt = now + 30 minutes`
  5. Retourne `{ sessionPublicId, createdAt, expiresAt, demoGuardUrl }`
- **Format d'ID :** `hcs_sess_<16 chars base64url>` (SHA-256 truncaté, préfixe `hcs_sess_`)
- **Durée de validité :** 30 minutes
- **Pas de persistance en DB :** la session est éphémère, non validée à la réception côté hybrid-vector-api.

### 2b) Côté legacy payguard — consommation

`payguard/src/pages/DemoGuard.tsx:217-227` :
```tsx
const [searchParams] = useSearchParams();
const [sessionPublicId, setSessionPublicId] = useState('');

useEffect(() => {
  const querySession = searchParams.get('sessionPublicId');
  if (querySession && /^hcs_sess_[A-Za-z0-9_-]+$/.test(querySession)) {
    setSessionPublicId(querySession);
  }
}, [searchParams]);
```
- Lit `?sessionPublicId=` au mount via `useSearchParams`
- Valide le format avec regex `^hcs_sess_[A-Za-z0-9_-]+$`
- **Ne auto-submit PAS** — pré-remplit le champ, l'utilisateur doit cliquer "Start DemoGuard Check"
- L'ID est injecté dans le payload à `hcs_session_public_id` (`DemoGuard.tsx:895`)

### 2c) Côté demoguard-app — verdict : **GAP CRITIQUE**

**`demoguard-app/src/screens/IdleScreen.tsx:14-20` :**
```tsx
export function IdleScreen({ onStart }: Props) {
  const [sessionId, setSessionId] = useState('');

  const handleStart = () => {
    const id = sessionId.trim() || `dg_${Date.now().toString(36)}`;
    onStart(id);
  };
```

**GAP identifié :**
1. **Pas de lecture de `?sessionPublicId=` au mount.** Aucune utilisation de `useSearchParams`, `URLSearchParams`, ou `searchParams` dans `src/`. L'utilisateur doit saisir l'ID manuellement.
2. **Fallback génère un ID local `dg_<timestamp>`** au lieu de `hcs_sess_...`. Ce format ne passera pas la validation regex côté admin (mais le backend ne valide pas — voir §2d).
3. **Pas de validation du format `hcs_sess_`** côté demoguard-app.

**Comportement legacy à répliquer (minimal) :**
- Au mount de `IdleScreen` (ou `App`), lire `window.location.search` ou `useSearchParams`
- Extraire `sessionPublicId` du query string
- Si présent et valide (`/^hcs_sess_[A-Za-z0-9_-]+$/`), pré-remplir le champ `sessionId`
- Ne PAS auto-submit (l'utilisateur clique toujours sur "Démarrer le contrôle")
- Si absent, garder le comportement actuel (champ vide + fallback `dg_...`)

**Impact du GAP :**
- Le bouton "Open DemoGuard" du Cognitive Terminal ouvre `https://<demoguard-app-url>?sessionPublicId=hcs_sess_...`
- demoguard-app ignore ce paramètre → l'ID n'est pas pré-rempli → l'utilisateur doit le copier/coller manuellement
- Le fallback `dg_<timestamp>` génère un ID non-corélé à la session admin → le Cognitive Terminal ne recevra pas les events SSE

### 2d) Côté hybrid-vector-api / hcs-u7-backend — validation de sessionPublicId

**hybrid-vector-api (`src/routes/demoguard.ts:130`) :**
```ts
hcs_session_public_id: z.string().min(1, 'hcs_session_public_id is required'),
```
- **Validation :** Zod exige uniquement une chaîne non vide. **Pas de validation de format `hcs_sess_`**, pas de vérification d'existence en DB.
- **Verdict : INFORMATIF.** Le sessionPublicId est utilisé pour corréler les events SSE et les logs, mais n'est pas validé contre une session existante.

**hcs-u7-backend (`cognitive-sse.routes.ts`) :**
- La session demo n'est **PAS persistée** en DB. `deriveSessionPublicId` est déterministe (SHA-256), mais il n'y a pas de lookup.
- Le SSE stream utilise `sessionPublicId` comme clé de channel Redis/pub-sub — si l'ID n'existe pas, le stream reste vide (pas d'erreur).

**Conséquence si le nouveau client envoie un ID auto-généré `dg_...` :**
- hybrid-vector-api : accepté (passe Zod `min(1)`)
- Le proxy Vercel force `source = 'demoguard_mobile'` et `tenant_id = DEMOGUARD_TENANT_ID` — l'ID client n'affecte pas le tenant
- Le SSE stream côté admin sera vide (pas d'events publiés pour cet ID)
- Le monitoring record utilisera `demoguard:${sessionPublicId.slice(0,16)}` comme tenantId — fonctionnellement OK mais non-correlé à la session admin

**Verdict : Pas de blocage technique, mais perte de la corrélation Cognitive Terminal ↔ DemoGuard.**

---

## 3. CORS / ORIGINE — chaîne complète

### 3a) demoguard-app/api — contrôle d'origine

**`demoguard-app/api/demoguard/verify.ts:40-57,148-166` :**
- `PAYGUARD_ALLOWED_ORIGINS` est le **seul** contrôle d'origine (env var, comma-separated)
- Defaults hardcodés : `capacitor://localhost`, `https://localhost`, `http://localhost:5173`, `http://localhost:3001`
- Si l'origine ne matche pas : **403** `CORS_ORIGIN_DENIED`
- Si pas d'Origin header et pas Capacitor : **403** `Origin header required`
- **Comportement confirmé : 403 strict, pas de passthrough.**

**Action requise :** Sur le projet Vercel `demoguard-app`, configurer `PAYGUARD_ALLOWED_ORIGINS` avec l'URL de production de demoguard-app (ex: `https://demoguard-app.vercel.app`). Le nom de l'env var reste `PAYGUARD_ALLOWED_ORIGINS` (héritage du code copié depuis payguard).

### 3b) hybrid-vector-api route /demoguard — validation origin/referer

**`hybrid-vector-api/src/routes/demoguard.ts:147` :**
```ts
router.post('/verify', apiKeyMiddleware, async (req, res, next) => { ... })
```
- **Auth :** `apiKeyMiddleware` uniquement (header `X-API-Key` vs `HV_API_KEY`)
- **Aucune validation d'Origin/Referer** — grep `origin|referer|allowed_host` dans `routes/demoguard.ts` et `middleware/` → **0 résultat**
- **Verdict confirmé : pas de validation d'origine.** L'auth repose sur `HV_API_KEY` (server-side, injecté par le proxy Vercel).

### 3c) hcs-u7-proxy — hors chaîne DemoGuard

- grep `demoguard|payguard` dans `hcs-u7-proxy/src` → **0 résultat**
- **Confirmé : le proxy Cloudflare Worker n'est PAS dans la chaîne DemoGuard.**
- La chaîne DemoGuard est : `Client (payguard/demoguard-app) → Vercel serverless proxy (/api/demoguard/verify) → hybrid-vector-api (/demoguard/verify) → hcs-u7-backend (monitoring/SSE)`

---

## 4. AUTRES CONSOMMATEURS DU FLUX DEMOGUARD

### 4a) hcs-u7-backend — records DemoGuard

**`hcs-u7-backend/src/routes/monitoring/decision-record.routes.ts:284-304` :**
```ts
const record: DecisionRecord = {
  tenantId: `demoguard:${sessionPublicId.slice(0, 16)}`,
  source: 'demoguard',
  ...
};
```
- Le champ `source` est **toujours `'demoguard'`** — il ne distingue PAS payguard de demoguard-app.
- Le `tenantId` est dérivé de `sessionPublicId` (pas du tenant_id envoyé par le client).
- **Le proxy Vercel force `source = 'demoguard_mobile'` et `tenant_id = DEMOGUARD_TENANT_ID`** côté hybrid-vector-api, donc le client n'influence pas ces champs.

**Verdict :** Le changement de client n'a **aucun impact** sur les records backend. Le `source` reste `'demoguard'` et le `tenantId` reste dérivé du `sessionPublicId`. **Cohérent.**

### 4b) Brain / shadow dataset

- Les events publiés par `demoguardFusionTrigger.ts` utilisent `source: 'demoguard_mobile'` (hardcodé dans le code hybrid-vector-api, pas lu depuis le payload client).
- Le proxy Vercel force `body.source = 'demoguard_mobile'` avant de forwarder à hybrid-vector-api.
- Les champs du dataset (source, version, user-agent agrégé) sont :
  - `source` : `'demoguard_mobile'` (forcé, pas affecté par le client)
  - `version` : lu depuis `payload.demo_guard.version` — demoguard-app envoie `'1.0.0'` (même valeur que payguard)
  - `user-agent` : lu depuis `device.userAgent` — peut différer (navigateur web vs Capacitor) mais c'est déjà le cas entre les builds web/mobile de payguard

**Verdict : IMPACT NUL.** Le changement de client n'altère aucun champ utilisé par le dataset Brain/shadow.

### 4c) payguard — références /demoguard (à retirer plus tard)

| Fichier | Ligne | Référence |
|---------|-------|-----------|
| `src/constants/routes.ts` | 6 | `DEMOGUARD: '/demoguard'` |
| `src/App.tsx` | 7-8 | Import `DEMOGUARD_ENABLED`, `DemoGuard` |
| `src/App.tsx` | 27 | `<Route path={ROUTES.DEMOGUARD} ...>` |
| `src/pages/DemoGuard.tsx` | 1-1695 | Page DemoGuard complète (legacy) |
| `src/demoguard/` | — | Dossier complet (collectors, cognitive, behavior, quality, types, constants, api) |
| `api/demoguard/verify.ts` | 1-305 | Proxy serverless legacy |
| `api/_lib/demoguardSanitize.ts` | — | Sanitizer du proxy legacy |
| `.env.local` | 3 | `VITE_API_URL="https://payguard-one.vercel.app/api"` |
| `.env.production.example` | 15-21 | `PAYGUARD_HV_API_URL`, `PAYGUARD_ALLOWED_ORIGINS`, `DEMOGUARD_TENANT_ID`, etc. |

**Note :** Ces références restent en place. Elles seront retirées dans une phase postérieure (PAS maintenant).

---

## 5. VERDICTS RÉCAPITULATIFS

| Section | Verdict | Détail |
|---------|---------|--------|
| 2c — sessionPublicId côté demoguard-app | **GAP CRITIQUE** | demoguard-app ne lit pas `?sessionPublicId=` au mount. Fallback `dg_` non-correlé. |
| 2d — Validation sessionPublicId côté backend | **INFORMATIF** | Pas de validation d'existence. ID auto-généré accepté mais SSE vide. |
| 3a — CORS demoguard-app | **OK (env var à configurer)** | `PAYGUARD_ALLOWED_ORIGINS` contrôle tout, 403 strict. |
| 3b — CORS hybrid-vector-api | **CONFIRMÉ : pas de validation origin** | Auth par `X-API-Key` uniquement. |
| 3c — hcs-u7-proxy | **HORS CHAÎNE** | Aucune référence demoguard/payguard. |
| 4a — Records backend | **IMPACT NUL** | `source` et `tenantId` forcés server-side, pas affectés par le client. |
| 4b — Brain / shadow dataset | **IMPACT NUL** | `source: 'demoguard_mobile'` hardcodé, version identique. |

---

## 6. PLAN DE BASCULE — ordonné et minimal

### Changements requis

| # | Repo | Type | Changement | Détail |
|---|------|------|------------|--------|
| 1 | **demoguard-app** | **Commit** | Ajouter lecture `?sessionPublicId=` au mount de `IdleScreen` | Répliquer le comportement legacy payguard : `useSearchParams` + validation `hcs_sess_` + pré-remplissage sans auto-submit |
| 2 | **hcs-u7-backend** | **Env var (Render)** | `DEMOGUARD_URL` | Changer la valeur vers l'URL de production demoguard-app (ex: `https://demoguard-app.vercel.app`). Si non défini, le fallback `https://payguard-one.vercel.app/demoguard` reste actif. |
| 3 | **demoguard-app** | **Env var (Vercel)** | `PAYGUARD_ALLOWED_ORIGINS` | Configurer avec l'URL de production demoguard-app (ex: `https://demoguard-app.vercel.app`) |
| 4 | **demoguard-app** | **Env var (Vercel)** | `HV_API_KEY` | Même valeur que payguard (clé hybrid-vector-api) |
| 5 | **demoguard-app** | **Env var (Vercel)** | `HYBRID_VECTOR_API_URL` | `https://hybrid-vector-api-m5xt.onrender.com` (même que payguard) |
| 6 | **demoguard-app** | **Env var (Vercel)** | `DEMOGUARD_TENANT_ID` | `demoguard-demo` (même que payguard) |

### Ce qui NE change PAS

- **hybrid-vector-api** : aucune modification (route `/demoguard/verify` inchangée, Zod schema inchangé, pas de validation d'origin)
- **hcs-u7-backend** : aucune modification de code (seulement env var `DEMOGUARD_URL` sur Render)
- **hcs-u7-proxy** : aucune modification (hors chaîne DemoGuard)
- **hcs-u7-admin** : aucune modification (reçoit l'URL du backend, ne la génère pas)
- **payguard** : aucune modification (reste en place, sera retiré plus tard)

### Ordre d'exécution

1. **Commit demoguard-app** : ajouter la lecture de `?sessionPublicId=` dans `IdleScreen.tsx` (le seul changement de code requis)
2. **Deploy demoguard-app sur Vercel** : trigger le build + deploy
3. **Configurer les env vars sur Vercel** (projet demoguard-app) :
   - `PAYGUARD_ALLOWED_ORIGINS` = URL de production demoguard-app
   - `HV_API_KEY` = clé hybrid-vector-api
   - `HYBRID_VECTOR_API_URL` = `https://hybrid-vector-api-m5xt.onrender.com`
   - `DEMOGUARD_TENANT_ID` = `demoguard-demo`
4. **Changer `DEMOGUARD_URL` sur Render** (hcs-u7-backend) → URL de production demoguard-app
5. **Smoke test** : depuis le Cognitive Terminal admin, cliquer "Create Demo Session" → "Open DemoGuard" → vérifier que demoguard-app s'ouvre avec l'ID pré-rempli → compléter le flow → vérifier que les events SSE apparaissent dans le Cognitive Terminal

### Points de rollback

- **Rollback immédiat** : remettre `DEMOGUARD_URL` sur Render à `https://payguard-one.vercel.app/demoguard` (ou supprimer l'env var pour utiliser le fallback hardcoded)
- **Rollback demoguard-app** : undeploy sur Vercel (ou revert le commit)
- **Aucun impact sur payguard** : l'ancien client reste fonctionnel en parallèle

---

## 7. DÉTAIL DU GAP CRITIQUE — sessionPublicId

### Comportement legacy (payguard) à répliquer

```tsx
// payguard/src/pages/DemoGuard.tsx:217-227
const [searchParams] = useSearchParams();
const [sessionPublicId, setSessionPublicId] = useState('');

useEffect(() => {
  const querySession = searchParams.get('sessionPublicId');
  if (querySession && /^hcs_sess_[A-Za-z0-9_-]+$/.test(querySession)) {
    setSessionPublicId(querySession);
  }
}, [searchParams]);
```

### État actuel demoguard-app

```tsx
// demoguard-app/src/screens/IdleScreen.tsx:14-20
export function IdleScreen({ onStart }: Props) {
  const [sessionId, setSessionId] = useState('');

  const handleStart = () => {
    const id = sessionId.trim() || `dg_${Date.now().toString(36)}`;
    onStart(id);
  };
```

### Changement minimal requis

Dans `IdleScreen.tsx`, ajouter :
1. Import `useSearchParams` de `react-router-dom` (ou lecture native `window.location.search` si pas de router)
2. Au mount, lire `sessionPublicId` du query string
3. Si valide (`/^hcs_sess_[A-Za-z0-9_-]+$/`), pré-remplir `sessionId`
4. Garder le fallback `dg_...` si l'ID est absent (pour les tests standalone sans admin)

**Note :** demoguard-app utilise un router simple (pas de `react-router-dom` visible dans `App.tsx`). Il faudra soit ajouter `react-router-dom`, soit lire `window.location.search` directement. La solution la plus légère est `new URLSearchParams(window.location.search)`.

---

**Fin du rapport.**
