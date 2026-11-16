# Flujo de trabajo — Dione en Claude Code (16-nov-2026)

## Principio

Se trabaja en local y GitHub es la fuente de verdad. La nube sirve para desplegar y para revisar, no como lugar donde se escribe el código.

## Por qué local

- El proyecto es Vite con tests, migraciones y funciones en `api/`. Correrlo y probarlo en la máquina es más rápido y más fácil de depurar.
- Las claves (`.env`) se quedan en la laptop. En la nube viven solo en las variables de entorno de Vercel.
- Git ya está montado en `Downloads\dione`.

## Para qué sirve la nube

- Vercel despliega solo con cada push a `main`. Ahí se publica la app.
- GitHub (`Shalkosss/dione`) guarda el historial y los PRs, y es el punto de sincronización entre laptops.

## Rutina en cualquier máquina

1. `git pull` antes de empezar.
2. Trabajar y probar en local (`npm run build` y los tests).
3. `git commit` y `git push`.
4. Vercel despliega.

## Qué vive dónde

| Cosa | Dónde vive | Nota |
|---|---|---|
| Código | GitHub, rama `main` | Lo desplegado en Vercel es `main` |
| Documentos del método | `project-docs/` en el repo, con copia en el proyecto de Claude | Claude Code no puede leer el proyecto de Claude. Lo que deba leer tiene que estar en el repo |
| Claves | `.env` local y Vercel | Nunca en documentos ni en el repo |
| Chats de Claude Code | Solo en la laptop donde se hicieron | No se sincronizan. Lo que importe de ellos debe quedar escrito en `CLAUDE.md` o en `project-docs/` |
| Plan de trabajo | `ROADMAP_CLAUDE_CODE.md` | Fase 0 a Fase 5 |

## Cuando cambia un documento del método

Si el cambio nace en el chat del proyecto de Claude, se descarga y se copia a `project-docs/` con un commit. Si nace en Claude Code, se sube el archivo al proyecto de Claude. Una sola dirección por cambio, para que las dos copias no vuelvan a divergir.
