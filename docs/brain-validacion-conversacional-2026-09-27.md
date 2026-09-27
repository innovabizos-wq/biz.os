# Corrección del recorrido conversacional de Brain

## Problemas comprobados

- La barra abría una ventana debajo del encabezado al recibir foco, antes de enviar un mensaje.
- La búsqueda de capacidades devolvía habilidades que no estaban registradas como herramientas ejecutables en ese turno.
- Las aprobaciones enviadas desde el navegador se validaban junto con decisiones automáticas anteriores. Una conversación con consulta y modificación podía bloquearse al continuar.
- El historial conservaba respuestas vacías y cargaba los primeros 200 mensajes, dejando fuera los más recientes en conversaciones largas.
- Los errores del flujo podían quedar registrados como ejecuciones completadas sin respuesta. El mensaje genérico en inglés tampoco se traducía cuando terminaba en punto.
- Una petición combinada real se detuvo porque el modelo eligió un límite de registros superior al admitido por las herramientas.

## Cambios

- Escribir o enfocar la barra conserva la pantalla actual. Enviar o pulsar el botón de conversación abre una ventana centrada, con historial desplazable y editor multilínea.
- Las habilidades autorizadas se registran en el servidor. El modelo recibe un conjunto acotado; la búsqueda habilita otras herramientas para el siguiente paso. Se conservan las políticas de permisos, aprobación y ejecución durable.
- Las consultas pueden corregir automáticamente un tamaño de página fuera de límites. Esta reparación no modifica importes, cantidades comerciales ni solicitudes de escritura.
- Las aprobaciones muestran los datos propuestos. El servidor conserva el mensaje original y admite únicamente decisiones nuevas sobre propuestas persistidas; bloquea cambios de argumentos, resultados inventados y repeticiones.
- Se recuperan los mensajes recientes, se excluyen respuestas vacías y no se repiten navegaciones históricas al recargar. La sincronización entre la barra y la página de Brain no sustituye una respuesta mientras se genera.
- Se registran los fallos del flujo y se muestran mensajes comprensibles. Una herramienta fallida no muestra “Resultado guardado”. El último paso disponible se reserva para responder al usuario.

## Verificación y límites

Las pruebas automatizadas del agente utilizan un modelo controlado para comprobar el ciclo real de selección, descubrimiento, ejecución y síntesis; no se limitan a buscar nombres de skills. También comprueban aprobación, denegación, propuestas alteradas, límites y errores del proveedor.

La prueba del catálogo completo verifica la serialización de los esquemas mediante el adaptador Gemini instalado. **No equivale a ejecutar cada operación de negocio ni a certificar integraciones externas.**

Antes del cambio se reprodujeron en producción un saludo, una consulta de cotizaciones, una comparación que fallaba por límites y una propuesta de artículo que solicitaba aprobación. La versión `78cb854` sí estaba desplegada; el texto genérico en inglés no demostraba un despliegue atrasado.

La capacidad de razonamiento depende del modelo configurado, sus cuotas y las operaciones disponibles. Estos cambios no sustituyen al proveedor ni habilitan acciones sin permisos. La validación posterior al despliegue debe incluir consulta combinada, seguimiento conversacional, aprobación de una acción de prueba y recuperación del historial.
