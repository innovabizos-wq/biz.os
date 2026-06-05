# Contexto Del Negocio

Contexto del negocio es una configuracion transversal de empresa. No pertenece
a Autoblog ni a ningun modulo operativo especifico: es la base de identidad,
reglas, conocimiento y limites que biz.os usara para asistir a la empresa.

## Ruta

```text
/admin/contexto
```

## Que Contiene

- Identidad: resumen, mision, vision, valores, personalidad y tono.
- Mercado: publico objetivo, dolores del cliente, zona geografica, competidores y diferenciadores.
- Oferta: productos, servicios, ofertas, precios y proceso de servicio.
- Operacion: horarios, cobertura, reglas operativas, comerciales y de atencion.
- IA y contenido: CTA, keywords, temas prohibidos, disclaimers e instrucciones.
- Notas internas.

## Seguridad

La tabla `business_context` guarda una sola fila por empresa. El frontend no
envia `empresa_id`; las RPCs resuelven la empresa con `current_empresa_id()`.

Permisos:

```text
admin.settings.view
admin.settings.manage
```

Ver requiere `admin.settings.view` o `admin.settings.manage`. Guardar requiere
`admin.settings.manage`.

## Uso Transversal

Este contexto alimentara modulos inteligentes actuales y futuros:

- Autoblog.
- Asistente IA.
- WhatsApp / Inbox.
- Respuestas automaticas.
- Reportes.
- Cotizaciones.
- Campanas.
- Automatizaciones.
- Atencion al cliente.
- Analisis gerencial.

Autoblog consume este contexto, pero no lo posee ni lo duplica.
