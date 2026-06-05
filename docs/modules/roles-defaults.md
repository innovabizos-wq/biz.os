# Roles Estandar

Las empresas nuevas creadas por `bootstrap_empresa_inicial` reciben roles
estandar. El fundador queda asignado a `Super Admin`.

## Roles

- `Super Admin`: acceso total a todos los permisos activos existentes.
- `Administrador`: administracion operativa sin permisos criticos de roles ni
  configuracion avanzada.
- `Supervisor`: supervision, lectura operativa y reportes.
- `Vendedor`: clientes, seguimientos, cotizaciones, ventas e inbox.
- `Servicio al cliente`: conversaciones, atencion, CRM basico y seguimientos.
- `Bodeguero`: catalogo, inventario, bodegas y apoyo a despacho.
- `Chofer / Repartidor`: despacho, estado de entrega y `driver.tracking.use` si
  existe.
- `Contabilidad / Facturacion`: ventas administrativas, clientes, cotizaciones y
  reportes.
- `RRHH`: personal, usuarios, roles lectura y planillas.

Los roles son editables desde Administracion -> Roles, salvo protecciones sobre
`Super Admin`.

## Proteccion Super Admin

`Super Admin` se marca como `es_sistema = true`, se muestra con badges
"Acceso total" y "Protegido", y la migracion `0027_roles_estandar_empresa.sql`
protege:

- renombrarlo
- inactivarlo
- quitarle permisos

Esto evita dejar a la empresa sin acceso total.

## Chofer / Repartidor

Como `roles` no tiene columna `metadata`, no se guarda metadata operativa en
esta fase. El rol queda identificado por nombre, badge "Despacho / Ubicacion" y
permisos reales disponibles:

- `dispatch.orders.view`
- `dispatch.orders.status.change`
- `driver.tracking.use` si la migracion de tracking ya fue aplicada

Queda preparado para app chofer/tracking sin inventar permisos nuevos.

## Empresa Existente

La RPC `instalar_roles_estandar_empresa()` usa `current_empresa_id()`, no acepta
`empresa_id`, valida permisos administrativos y crea solo roles faltantes. No
borra roles existentes, no sobrescribe roles existentes y asigna permisos solo a
roles nuevos o roles estandar existentes sin quitar permisos previos.

La UI muestra el boton "Instalar roles estandar" si faltan roles estandar.

## Permisos

Solo se asignan permisos activos existentes. Si un permiso sugerido no existe,
se omite sin fallar. `Super Admin` recibe todos los permisos activos.
