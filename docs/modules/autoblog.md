# Autoblog

Autoblog es un modulo principal de biz.os, visible directamente en la barra
lateral cuando el modulo esta activo para la empresa y el usuario tiene permisos.
No vive dentro de Marketing y no existe ruta `/marketing`.

## Rutas

```text
/autoblog
/autoblog/nuevo
/autoblog/[articleId]
```

## Relacion Con Contexto Del Negocio

Autoblog consume `business_context` para preparar contenido alineado con la
identidad, reglas, oferta y limites de la empresa. El contexto del negocio es
transversal y no pertenece a Autoblog.

## MVP Actual

Autoblog en esta fase:

- Crea articulos.
- Guarda borradores.
- Permite revision.
- Aprueba contenido.
- Deja contenido listo para publicar manualmente.
- Genera y guarda copys para redes.
- Permite URLs y notas de fuentes pegadas manualmente.

Estados de articulo:

```text
draft = Borrador
pending_review = En revisión
approved = Aprobado
ready_to_publish = Listo para publicar
archived = Archivado
```

`ready_to_publish` significa que el contenido quedo listo dentro de biz.os para
copiar, compartir o publicar manualmente. No significa publicacion externa.

## IA Y Noticias

La estructura de generacion IA existe, pero no llama a ningun proveedor todavia.
Si no hay proveedor configurado, el sistema muestra:

```text
La generacion IA todavia no esta configurada. Puedes crear el articulo manualmente.
```

La funcion de noticias esta preparada como placeholder. En esta fase no hay cron,
scraping, busqueda web desde frontend ni integracion con News API. Las fuentes se
pegan manualmente como URLs y notas.

## Futuro

Fases posteriores podran agregar:

- Publicacion automatica.
- Conexion con WordPress o sitio web propio.
- Conexion con Facebook, Instagram y LinkedIn.
- Programacion automatica.
- Generacion diaria de 3 a 5 articulos segun el nicho.
- Cron seguro de contenido.

## Seguridad

El frontend no envia `empresa_id`. Las RPCs resuelven empresa con
`current_empresa_id()` y validan permisos:

```text
autoblog.view
autoblog.create
autoblog.edit
autoblog.publish
autoblog.manage
```

No se usa `SUPABASE_SERVICE_ROLE_KEY` ni se exponen API keys.
