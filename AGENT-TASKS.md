# StillNoob — Agent Task Handoff

> Tareas detalladas para ejecutar con un agente de Claude Code.
> Cada tarea es independiente y puede ejecutarse en un terminal separado.
> Lee PROJECT.md para contexto completo del proyecto.

---

## Task 1: Limpiar warnings de ESLint

**Contexto**: ESLint ya está configurado. Hay 12 warnings de variables no usadas.

**Ejecutar**:

```bash
cd c:/Proyectos/stillnoob
npx eslint packages/api/src/ --fix
```

**Instrucciones**:

1. Ejecuta `npx eslint packages/api/src/` para ver los warnings actuales
2. Para cada variable sin usar: evalúa si se puede borrar el import o si se necesitará pronto
3. Si el import es claramente innecesario, elimínalo
4. Si la variable se usa más abajo pero ESLint no lo detecta (por SQL template literals), prefija con `_`
5. Después de cada fix, re-ejecuta `npx eslint packages/api/src/` hasta tener 0 warnings
6. Ejecuta `npx vitest run` para verificar que nada se rompió
7. Commit: `fix: clean up unused imports flagged by eslint`

---

## Task 2: Añadir más tests de API

**Contexto**: Ya hay un test básico en `packages/api/src/__tests__/health.test.js`. Vitest y Supertest están instalados.

**Instrucciones**:

1. Lee `packages/api/src/app.js` para entender la estructura de rutas
2. Lee `packages/api/src/routes/auth.js` — crea tests para:
   - POST `/api/v1/auth/register` — registrar usuario (validar campos requeridos, email duplicado)
   - POST `/api/v1/auth/login` — login exitoso y fallido
   - GET `/api/v1/auth/me` — sin token devuelve 401
3. Lee `packages/api/src/routes/public.js` — crea tests para:
   - GET `/api/v1/public/character/:region/:realm/:name` — ruta pública
4. Crea archivos:
   - `src/__tests__/auth.test.js`
   - `src/__tests__/public.test.js`
5. Usa la misma estructura que `health.test.js`
6. Para tests que necesitan DB, usa una base SQLite en memoria o skipea con `it.skip`
7. Ejecuta: `npx vitest run` — todos deben pasar
8. Commit: `test: add auth and public route tests`

---

## Task 3: Refactorizar server.js del DKP Backend

**Contexto**: `c:/Proyectos/dkp-backend/server.js` tiene ~4500 líneas con TODAS las rutas API. El proyecto StillNoob ya tiene la estructura correcta (`routes/`, `middleware/`, `services/`). Usar StillNoob como referencia.

**Instrucciones**:

1. Lee `server.js` completo para entender la estructura
2. Identifica grupos de endpoints:
   - Auth routes (login, register, profile) → `routes/auth.js`
   - Member routes (DKP, members list) → `routes/members.js`
   - Character routes (CRUD, primary) → `routes/characters.js`
   - Calendar routes (signups, raid days) → `routes/calendar.js`
   - Auction routes (active, bid, create) → `routes/auctions.js`
   - WCL routes (import, process) → `routes/wcl.js`
   - Analytics routes (superlatives, performance) → `routes/analytics.js`
   - BIS routes (items, equipment) → `routes/bis.js`
   - Admin routes (config, bulk ops) → `routes/admin.js`
3. Crea `routes/` directory con cada archivo
4. Cada archivo exporta un Express Router
5. `server.js` queda solo con: imports, middleware setup, route mounting, socket.io setup, server start
6. **Mantener Socket.IO en server.js** — no intentar extraerlo
7. Migra un grupo a la vez, verifica que funciona con `/restart`, migra el siguiente
8. Commit por cada grupo de rutas extraído

**Principios**:

- NO cambiar la lógica de negocio, solo mover código
- Mantener las mismas rutas exactas (no renombrar endpoints)
- Los middlewares compartidos (auth, role check) van a `middleware/`
- La conexión a DB (`database.js`) ya está extraída, importarla en cada ruta

---

## Task 4: TypeScript gradual en StillNoob

**Contexto**: Todo es vanilla JS. Para el launch (Mar 17) no es prioritario, pero post-launch queremos migrar gradualmente.

**Instrucciones**:

1. Instalar TypeScript y tipos:
   ```bash
   cd packages/api
   npm install -D typescript @types/node @types/express @types/cors @types/cookie-parser @types/jsonwebtoken @types/bcryptjs @types/supertest
   ```
2. Crear `tsconfig.json` permisivo:
   ```json
   {
     "compilerOptions": {
       "allowJs": true,
       "checkJs": true,
       "noEmit": true,
       "esModuleInterop": true,
       "moduleResolution": "node",
       "target": "ES2022",
       "module": "ES2022",
       "strict": false,
       "skipLibCheck": true
     },
     "include": ["src/**/*"]
   }
   ```
3. Esto permite `checkJs` — TypeScript verifica archivos .js sin renombrarlos
4. Ejecutar `npx tsc --noEmit` para ver errores de tipo
5. Arreglar los más críticos (especialmente en `services/analysis.js` y `services/wcl.js`)
6. **NO renombrar archivos a .ts** todavía — solo usar checkJs
7. Añadir `"typecheck": "tsc --noEmit"` al package.json scripts
8. Añadir typecheck al CI workflow

---

## Task 5: Configurar Sentry (error monitoring)

**Contexto**: No hay monitorización de errores en producción. Sentry tiene free tier (5K events/mes).

**Instrucciones**:

1. Crear cuenta en sentry.io (si no existe)
2. Crear proyecto "stillnoob-api" (Node.js)
3. Instalar:
   ```bash
   cd packages/api
   npm install @sentry/node
   ```
4. Inicializar en `src/index.js` (ANTES de cualquier otro import):
   ```js
   import * as Sentry from '@sentry/node';
   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     environment: process.env.NODE_ENV,
     tracesSampleRate: 0.1,
   });
   ```
5. Añadir error handler de Sentry en `app.js` (DESPUÉS de todas las rutas, ANTES del error handler genérico):
   ```js
   Sentry.setupExpressErrorHandler(app);
   ```
6. Añadir `SENTRY_DSN` a `.env.example` y a `render.yaml`
7. Actualizar Render env vars con el DSN real
8. Test: lanzar un error intencional y verificar que aparece en Sentry dashboard

---

## Task 6: Git Worktrees para trabajo paralelo

**Contexto**: El developer trabaja con múltiples terminales Claude simultáneos. Actualmente comparten el mismo directorio, lo que causa conflictos de archivos y locks.

**Instrucciones para el developer** (no para un agente, para el usuario):

```bash
# Crear worktrees para trabajo paralelo
cd c:/Proyectos/stillnoob

# Worktree para feature development
git worktree add ../stillnoob-dev dev

# Worktree para testing/CI work
git worktree add ../stillnoob-test test-infra

# Cada terminal Claude trabaja en su propio directorio:
# Terminal 1: c:/Proyectos/stillnoob (main branch, infra)
# Terminal 2: c:/Proyectos/stillnoob-dev (dev branch, features)
# Terminal 3: c:/Proyectos/stillnoob-test (test branch, testing)
```

**Beneficios**:

- Cada agente trabaja en archivos aislados, sin conflictos
- Git comparte el historial, así que pueden ver los commits del otro
- Merge branches cuando estén listos

---

## Task 7: Mejorar CLAUDE.md del DKP Backend

**Contexto**: El CLAUDE.md actual tiene ~180 líneas con mucho detalle de schema y endpoints. La recomendación es mantenerlo <100 líneas para no consumir contexto innecesariamente.

**Instrucciones**:

1. Lee `c:/Proyectos/dkp-backend/.claude/CLAUDE.md`
2. Mueve el detalle de "Database Schema" a `docs/schema.md` — deja solo una referencia en CLAUDE.md
3. Mueve el detalle de "API Endpoints" a `docs/api.md` — deja solo las rutas principales
4. Mueve "Display & UI Conventions" a `docs/conventions.md`
5. CLAUDE.md queda con:
   - Overview (2 líneas)
   - Tech stack (5 líneas)
   - Key commands (build, start, test)
   - Critical conventions (que Claude se equivoca sin ellas)
   - Links a docs detallados
6. Target: <100 líneas
7. Commit: `docs: slim down CLAUDE.md, extract details to docs/`

---

_Cada tarea es independiente. Prioridad recomendada: 1 → 2 → 3 → 7 → 4 → 5 → 6_
