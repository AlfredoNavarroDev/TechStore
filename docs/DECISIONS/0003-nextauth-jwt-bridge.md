# 0003 — NextAuth como orquestador de sesión, Nest como emisor de JWT

## Estado
Aceptado

## Contexto
El frontend necesita login con credenciales y OAuth (Google). El backend Nest necesita ser la única fuente de verdad de roles/permisos (`RolesGuard`). Opciones: (a) NextAuth maneja todo el auth y el backend confía ciegamente en la sesión de NextAuth: (b) NextAuth solo orquesta el flujo de login/OAuth mientras Nest emite y valida su propio JWT.

## Decisión
NextAuth actúa como capa de orquestación de sesión en el frontend (Credentials provider + Google provider), pero **el JWT real de autorización lo emite Nest**:
- Credentials: `authorize()` de NextAuth llama `POST /auth/login` en Nest.
- OAuth: callback `signIn` de NextAuth llama `POST /auth/oauth/verify` en Nest (upsert de usuario).
- En ambos casos, el JWT devuelto por Nest se guarda dentro del `token`/`session` de NextAuth (callback `jwt`) y se reenvía como `Authorization: Bearer` en cada llamada a la API.

## Consecuencias
- Roles y permisos viven y se validan únicamente en Nest (`RolesGuard`, `@Roles()`), evitando lógica de autorización duplicada en el frontend.
- El JWT interno de NextAuth (para la sesión de Next) es distinto del JWT de Nest — hay que tener cuidado de no confundirlos al depurar.
- Si Nest cambia su esquema de JWT (claims, expiración), solo se actualiza el callback `jwt` de NextAuth, no toda la lógica de auth del frontend.
- Revocación de sesión: al hacer logout se invalida la sesión de NextAuth; revocación de JWT de Nest (si se requiere antes de expiración) se maneja vía blacklist en Redis (ver ADR 0002) a futuro si se necesita.
