# Autoblog

Autoblog es un modulo principal de biz.os, visible directamente en la barra
lateral cuando el modulo esta activo para la empresa y el usuario tiene permisos.
No vive dentro de Marketing y no existe ruta `/marketing`.

## Agente Responsable

El agente responsable de Autoblog dentro de Biz.Brain es el Agente de Marketing.
Autoblog se mantiene como modulo independiente, pero Marketing es el encargado
de operar sus capacidades inteligentes: temas, briefs, borradores, SEO, calidad
editorial, reutilizacion, calendario, rendimiento y preparacion de publicacion.

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

## IA E Investigacion Web

Autoblog usa el proveedor IA compartido de Biz.Brain cuando la capa de IA esta
activa y tiene una credencial valida en Administracion / IA. Antes de redactar,
el flujo de generacion intenta construir referencias reales:

- Si el usuario pega URLs, Autoblog intenta leer esas paginas.
- Si no hay URLs y el origen es `internal_context`, `news` o `trend`, Autoblog
  intenta buscar referencias web publicas y leer las fuentes accesibles.
- Las fuentes leidas se guardan en el articulo como `source_urls`.
- Los hallazgos extraidos se agregan a `source_notes` para que el modelo redacte
  con evidencia y no invente referencias.

Si no hay proveedor configurado, el sistema muestra:

```text
La generacion IA todavia no esta configurada. Puedes crear el articulo manualmente.
```

La busqueda web se ejecuta desde servidor y bloquea URLs locales o privadas para
evitar lecturas internas no autorizadas. Si la red externa no responde o ninguna
fuente es legible, el borrador puede generarse solo con contexto interno y notas
manuales, pero no debe inventar fuentes.

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
