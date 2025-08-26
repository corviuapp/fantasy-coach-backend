# Fantasy Coach NFL - Estado del Proyecto

## PROBLEMA ACTUAL
Backend no puede hacer deploy en Railway. Error: "Cannot GET /auth/yahoo/callback"

## SOLUCIÓN REQUERIDA
Migrar backend de Railway a Vercel. NO cambiar código, solo el hosting.

## LO QUE FUNCIONABA (NO TOCAR)
- OAuth con Yahoo
- Leagues y rosters 
- Start/Sit analyzer
- Todo el frontend

## CONFIGURACIÓN RAILWAY (que no funcionó)
- Root Directory: /backend
- Start Command: npm start
- Error: Failed to snapshot repository

## NOTAS CRÍTICAS
- El código funcionaba al 95% el viernes
- Solo fallaba la detección automática del equipo del usuario
- Un Claude anterior rompió todo intentando "arreglar"
- NO se necesitan cambios de código, solo deploy
