# Auditoría de dependencias — 2026-09-14

## Resultado

`npm audit` terminó con 0 vulnerabilidades conocidas en 1.409 dependencias:

| Severidad | Resultado final |
|---|---:|
| Crítica | 0 |
| Alta | 0 |
| Moderada | 0 |
| Baja | 0 |

## Cambios aplicados

- Next.js y `eslint-config-next`: 16.2.6 → 16.3.5.
- Workflow: 4.8.3 → 4.8.8 dentro del rango compatible declarado.
- Dependencias transitivas compatibles renovadas mediante `npm audit fix` sin
  `--force`.
- `nanoid` de `@workflow/core`: 5.1.16 mediante override de revisión.
- `undici` de los mundos local y Vercel de Workflow: 7.29.0 mediante override
  de revisión.

No se aceptó la propuesta automática de instalar Workflow 2.0.6 porque habría
sido un cambio incompatible respecto de la arquitectura 4.x ya implementada.
Los overrides solo elevan revisiones con las correcciones publicadas y quedan
fijados en `package.json` para que instalaciones reproducibles no vuelvan a las
versiones vulnerables.

## Verificación posterior

- 190 pruebas aprobadas.
- TypeScript aprobado.
- ESLint aprobado con cero advertencias.
- Compilación optimizada de Next.js 16.3.5 aprobada.
- Workflow compiló 5 flujos y 11 pasos.
- El trazado de archivos del servidor incluye `xmllint.wasm`, los cuatro XSD
  fiscales 4.4, el XSD de firma XML y el manifiesto de hashes.
