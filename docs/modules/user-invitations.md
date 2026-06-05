# Invitaciones De Usuarios

Este documento queda como alias historico. La documentacion actual del flujo
"Agregar personal" vive en:

```text
docs/modules/users-invitations.md
```

Resumen: biz.os agrega colaboradores por invitacion, sin crear usuarios manuales
ni contrasenas temporales desde admin. La empresa se resuelve server-side con
`current_empresa_id()`, el frontend no envia `empresa_id`, y la contrasena la
crea el invitado con Supabase Auth.
