# 0001 — Neon Postgres como base de datos

## Estado
Aceptado

## Contexto
Necesitamos Postgres para el backend NestJS con TypeORM. Opciones: Postgres local (Docker), RDS/Cloud SQL administrado, o Neon (Postgres serverless cloud).

## Decisión
Usar **Neon** desde el inicio del proyecto, sin instancia local de Postgres.

## Consecuencias
- No requiere Docker Compose para levantar la base de datos; entorno de desarrollo más simple (solo `DATABASE_URL`).
- Connection string requiere `sslmode=require`.
- Neon ofrece branching de base de datos (útil a futuro para entornos de preview/PR).
- Dependencia de conectividad a internet incluso en desarrollo local.
- TypeORM `synchronize` deshabilitado siempre; se usa `migrations` para todo cambio de esquema, incluso en desarrollo, para evitar drift entre entornos.
