# Contribuir a TechStore

## Ramas

- `main` — siempre desplegable
- `feature/<módulo>-<descripción>` — ej. `feature/orders-checkout-flow`
- `fix/<descripción>` — bugfixes
- Sin commits directos a `main`; todo vía PR.

## Commits

Conventional Commits:
```
feat(products): agrega filtro por rango de precio
fix(payments): corrige verificación de firma webhook
docs(architecture): documenta flujo de guest cart
chore(deps): actualiza @nestjs/core a 11.1
```
Tipos: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`. Scope = módulo afectado (`auth`, `products`, `orders`, etc).

## Antes de abrir un PR

Backend:
```bash
cd backend
npm run lint
npm run test
npm run test:e2e
npm run build
```

Frontend:
```bash
cd frontend
npm run lint
npm run build
```

Si el cambio toca schema de datos: incluir migración TypeORM en el mismo PR (nunca `synchronize` en el flujo normal).

## Estructura de un PR

- Título en formato Conventional Commits
- Descripción: qué cambia y por qué (no solo qué)
- Checklist de `.github/PULL_REQUEST_TEMPLATE.md`
- Si agrega endpoint nuevo: actualizar `docs/API.md` (tabla de endpoints planeados) y decorators Swagger
- Si es decisión arquitectónica relevante: agregar ADR en `docs/DECISIONS/` (usar `docs/DECISIONS/TEMPLATE.md`)

## Convenciones de código

- Seguir patrones existentes del módulo antes de crear uno nuevo (ver `docs/ARCHITECTURE.md`)
- DTOs con `class-validator` + `@ApiProperty()` para Swagger
- No lógica de negocio en controllers — vive en services
- Nombres de recursos/rutas en inglés y plural (`/products`, no `/producto`)
- Sin `console.log` en código de producción — usar el `Logger` de Nest

## Variables de entorno

Nunca commitear `.env` / `.env.local`. Actualizar `.env.example` correspondiente si se agrega una variable nueva.
