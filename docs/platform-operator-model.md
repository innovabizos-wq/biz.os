# Platform Operator Model

Este documento define la separacion conceptual entre la plataforma biz.os,
las empresas cliente y los usuarios internos de cada empresa. No implica crear
un panel nuevo ni cambiar permisos actuales todavia.

## 1. Platform Admin / Operador SaaS

Representa a AInovaCR/biz.os como dueños y proveedores de la plataforma.

Responsabilidades:

- Administrar empresas cliente.
- Administrar planes, modulos, limites y health global.
- Dar soporte tecnico.
- Provisionar Whapp y canales externos.
- Configurar integraciones tecnicas que no deben quedar en manos del cliente.
- Mantener secretos globales, proveedores, webhooks y credenciales tecnicas.
- Auditar estado de Supabase, RLS, RPC, migraciones y seguridad.

Vista esperada futura:

- Platform Console.
- Empresas y planes.
- Modulos contratados.
- Health por tenant.
- Provision Whapp.
- Configuracion tecnica de integraciones.
- Herramientas de soporte.

Esta consola no existe como panel grande todavia. Debe documentarse y disenar
antes de implementarse.

Primera base funcional:

- `/platform`
- `/platform/empresas`
- `/platform/empresas/[empresaId]`
- `/platform/whapp`
- `/platform/health`
- `/platform/soporte`

Todas son internas y requieren un registro activo en `platform_users`.

## 2. Tenant Owner / Propietario De Empresa

Representa al cliente que compra biz.os, crea su empresa y opera su negocio.

Responsabilidades:

- Completar datos de empresa.
- Configurar sucursales, usuarios, roles internos y permisos.
- Activar o solicitar modulos permitidos por su plan.
- Configurar datos operativos del negocio.
- Usar CRM, cotizaciones, ventas, inventario, despacho, compras, pagos y demas modulos.
- Ver estado de integraciones como configurado, pendiente o con error.

No debe administrar:

- `SUPABASE_SERVICE_ROLE_KEY`.
- Access tokens globales.
- App secrets de Meta.
- Llaves tecnicas compartidas de proveedores.
- Webhook endpoints globales.
- Configuracion interna de Platform Console.

Puede administrar configuracion de negocio y datos visibles, pero no secretos
tecnicos de plataforma.

## 3. Company Users / Colaboradores

Representa usuarios internos del tenant:

- Administrador de empresa.
- Vendedor.
- Bodega.
- Chofer.
- Contador.
- Soporte.
- Otros roles operativos.

Responsabilidades:

- Usar los modulos segun permisos.
- Crear clientes, cotizaciones, ventas, movimientos, pagos o despachos segun rol.
- Ver solo datos de su empresa.

No deben ver ni administrar configuracion tecnica de plataforma.

## Nombres Actuales Y Ambiguedad

El codigo actual usa `Super Admin` como rol de empresa dentro del tenant. En el
estado actual debe interpretarse como Tenant Owner / Company Admin con acceso
total a la empresa, no como Platform Admin de AInovaCR.

No romper ahora:

- No renombrar tablas.
- No cambiar migraciones historicas.
- No cambiar permisos criticos.
- No cambiar comportamiento de roles actuales.

Migracion de nombres futura:

- `super_admin` o `Super Admin` global de plataforma -> `platform_admin`, si aplica.
- `Super Admin` actual de tenant -> `tenant_owner` o `company_admin`.
- `Administrador` actual -> `company_admin` si el rol mantiene alcance dentro de empresa.

Antes de implementar Platform Console, separar explicitamente roles de plataforma
de roles de tenant en schema, permisos, UI y documentacion.

## Habilitar Primer Platform Admin

No se asigna automaticamente ningun Platform Admin.

Para habilitar el primer operador SaaS, ejecutar manualmente SQL controlado en
Supabase con el `profile_id` correcto:

```sql
insert into public.platform_users (profile_id, role, notes)
values ('PROFILE_ID_AQUI', 'owner', 'Primer Platform Admin');
```

Roles disponibles:

- `owner`
- `admin`
- `support`
- `operator`
- `readonly`

El acceso a `/platform` no depende de permisos tenant ni de `empresa_id`.

## Aplicacion A Whapp

Whapp no debe depender de que cada cliente consiga por su cuenta todos los datos
tecnicos de Meta. Ese flujo es dificil, fricciona ventas y explica por que no
todas las empresas usan WhatsApp Cloud API directamente.

Modelo correcto:

- AInovaCR/biz.os actua como proveedor de la tecnologia Whapp.
- El cliente recibe o contrata un numero nuevo asignado para su empresa.
- Ese numero puede venir de la provision telefonica asociada, por ejemplo una
  central virtual con proveedor como RingCR, si el flujo comercial lo decide.
- El numero se usa para activar WhatsApp Business API cuando cumpla requisitos.
- El tenant ve su canal, numero, estado y salud.
- El tenant no tiene que copiar `Meta Business ID`, `WABA ID`, `Access Token` ni
  `App Secret` como tarea normal.

Regla comercial importante:

- WhatsApp API requiere numeros aptos para Meta.
- Normalmente no se puede usar un numero que ya esta registrado en WhatsApp o
  WhatsApp Business App.
- Si un cliente pregunta por usar su numero existente, la respuesta operativa es
  que debe liberarse/migrarse si Meta lo permite; para piloto y venta simple,
  biz.os debe preferir numero nuevo provisionado.

Datos que administra Platform Admin:

- Meta Business ID.
- WhatsApp Business Account ID.
- Phone Number ID.
- Access Token.
- App Secret.
- Verify Token.
- Webhook URL.
- Estado tecnico del canal.

La primera Platform Console no edita secretos. Solo muestra estado, empresa,
numero/Phone Number ID, WABA ID, webhook, health y ultimos eventos/errores.

Datos que ve o administra Tenant Owner:

- Numero asignado.
- Nombre del canal.
- Estado: pendiente, configurando, activo, con error, suspendido.
- Salud de conexion.
- Ultimo error legible.
- Conversaciones, contactos y asignaciones.

## Aplicacion A Facturacion

Tenant Owner administra:

- Datos fiscales de la empresa.
- Actividad economica.
- Sucursal y terminal.
- Ambiente deseado cuando aplique.

Platform Admin administra o asiste:

- Requisitos tecnicos de firma.
- Health fiscal.
- Validacion de llaves/certificados cuando el cliente no puede completarlo solo.
- Integraciones futuras con proveedor fiscal o Hacienda.

Secretos fiscales no deben mostrarse completos al cliente despues de guardarlos.

## Aplicacion A IA

Tenant Owner puede definir preferencias operativas:

- Habilitar o no IA si el plan lo permite.
- Modelo funcional o perfil de uso cuando se exponga.
- Limites visibles.

Platform Admin administra:

- Proveedores.
- API keys.
- Routing.
- Costos.
- Auditoria global.
- Herramientas disponibles.

Las acciones IA deben validar tenant, usuario, permiso, modulo activo y limites.

## Aplicacion A Modulos Y Planes

Platform Admin administra:

- Catalogo de planes.
- Modulos disponibles por plan.
- Provisionamiento.
- Health global.
- Soporte y suspensiones.

Tenant Owner administra:

- Activacion operacional de modulos permitidos.
- Roles y permisos internos.
- Configuracion de negocio asociada a modulos.

Company Users:

- Solo usan los modulos que su empresa tiene activos y su rol permite.

## Regla De Arquitectura

No mezclar Platform Admin con Tenant Owner. Un usuario con acceso total dentro de
una empresa no debe adquirir automaticamente privilegios sobre otras empresas ni
configuracion tecnica global.

`/admin` sigue siendo administracion del cliente dentro del tenant.
`/platform` es operacion interna de AInovaCR/biz.os y no sustituye Tenant App.
