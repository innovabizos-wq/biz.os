# Multiempresa Con Aislamiento Fuerte

biz.os permite muchas empresas en una misma plataforma, pero cada empresa opera
como un ecosistema independiente.

## Frontera De Seguridad

`empresa_id` es la frontera principal para toda tabla sensible. Clientes,
productos, inventarios, facturas, reportes, configuraciones y eventos
operativos futuros deben pertenecer a una empresa.

## Usuarios Operativos

Un usuario operativo pertenece a una sola empresa. No existe selector de empresa
para usuarios normales y no se usa una relacion multiempresa tipo
`empresa_usuarios`.

La empresa activa se resuelve asi:

```text
Supabase Auth user -> profiles.id -> profiles.empresa_id
```

`profiles` significa perfil operativo del usuario autenticado.

## Datos No Compartidos

Las empresas no comparten usuarios, clientes, productos, inventarios, facturas,
reportes, configuraciones ni datos operativos.

## Superadmin De Plataforma

El superadmin de plataforma debe vivir en una capa separada del modelo operativo.
No debe estar en `profiles`, no debe usar `empresa_id = null` y no debe crear
excepciones que debiliten RLS.
