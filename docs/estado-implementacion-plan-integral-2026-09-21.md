# Estado de implementación del plan integral de Biz.OS

**Fecha de corte:** 22 de septiembre de 2026
**Etapa actual:** Entrega 4 — confiabilidad del POS/PWA; homologaciones de Entrega 3 en paralelo
**Avance estimado de desarrollo:** 68 %
**Avance estimado hasta salida comercial completa:** 48 %
**Faltante estimado:** 32 % de construcción y 52 % hasta cumplir todos los criterios de venta, pilotos y homologaciones externas.

Los porcentajes representan alcance comprobado, no cantidad de pantallas. Una etapa solo llega al 100 % cuando cubre permisos, fallos, reintentos, documentación, pruebas reales y operación comercial.

## Estado por entrega

| Bloque | Avance estimado | Estado comprobado | Trabajo principal pendiente |
|---|---:|---|---|
| Base confiable | 74 % | Operaciones idempotentes, aislamiento por empresa, cola de integraciones, API v1, permisos de base, pruebas, compilación, lecturas operativas paginadas y migraciones activas en Supabase. | Probar instalación limpia y copia anonimizada de forma automática; restauración conjunta de base y archivos; monitoreo de producción y carga conjunta de 50 usuarios. |
| Entrega 1 — circuito comercial | 68 % | Cotización, venta, cobro idempotente, saldos y devoluciones parciales con efectos financiero, físico y fiscal independientes. Agenda tiene recordatorios del servidor. | Completar importaciones con vista previa por lote; paginación y deduplicación avanzada de CRM; variantes y códigos de barras; cerrar cancelaciones y recuperación completa del recorrido. |
| Entrega 2 — operaciones internas | 100 % del alcance acordado sin RRHH | Traslados atómicos, recepciones parciales idempotentes, cuentas por pagar sobre valor recibido, devoluciones a proveedor, saldo a favor, costo promedio ponderado, conteos físicos, reservas de ventas y despacho móvil con evidencia privada, entregas parciales y devoluciones operativas separadas de sus efectos financieros y fiscales. Inventario, compras y despacho usan páginas acotadas, búsquedas limitadas e indicadores calculados en la base. Los recorridos de administrador, vendedor y repartidor comprobaron acceso por rol. | RRHH queda fuera de esta medición y se retomará como bloque separado cuando se apruebe su alcance ajustado. La prueba de carga transversal de 50 usuarios permanece en Base confiable y validación comercial. |
| Entrega 3 — facturación e integraciones | 56 % | Documento canónico, XML 4.4, XSD oficial, firma XAdES, Hacienda, conectores declarativos, recuperación, importación XML y REST seguro. | Validar cuentas y contratos reales de GTI, FacturaProfesional y Alegra; completar matrices de tipos por proveedor; homologación y pruebas fiscales de todos los documentos comprometidos. |
| Entrega 4 — POS y PWA | 58 % | Núcleo POS, cajas, sesiones, reservas, PWA y recuperación desde IndexedDB. Las ventas pendientes comparten un cupo local acumulado, reciben secuencias atómicas y respetan la vigencia y terminal autorizadas aun después de recargar sin conexión. | Completar cierres provisionales, devoluciones desde caja, prueba real con varias terminales/dispositivos, impresión física y procedimiento fiscal de contingencia aprobado. |
| Entrega 5 — atención y publicación | 46 % | Inbox/Whapp tiene operación real de Meta, controles de permisos, campañas, webhooks, reintentos y costos. Autoblog genera y conserva contenido. | Publicación comercial completa en WordPress, Facebook, Instagram y LinkedIn; calendario y reintentos por destino; revisiones y permisos externos. |
| Entrega 6 — reportes, IA y Brain | 61 % | Brain tiene herramientas, memoria, presupuestos, aprobaciones persistentes, flujos recuperables, métricas y separación por permisos. | Reportes operativos completos con trazabilidad al detalle; validar costos y calidad en carga; reducir el paquete inicial de Brain y cerrar recuperación de efectos parciales y evidencias en toda recomendación. |
| Preparación y validación comercial | 10 % | Consola y fundamentos de planes, salud y soporte existen parcialmente. | Planes comerciales finales, activación/suspensión, ayuda, soporte, respaldo restaurado, pruebas de volumen y pilotos de diez jornadas con tres negocios. |

## Entregas recientes comprobadas en Supabase

- Pagos protegidos contra doble clic, concurrencia y sobrepagos.
- Devoluciones de ventas parciales con crédito/reembolso, inventario y nota fiscal separados.
- Recepciones de compra repetibles sin duplicar mercancía.
- Devoluciones a proveedor con salida física y ajuste financiero separados.
- Registro de saldo a favor cuando una compra ya pagada reduce su valor.
- Cuentas por pagar calculadas sobre lo realmente recibido.
- Costo promedio ponderado por producto y bodega, conservado en traslados.
- Costo congelado en cada movimiento de inventario.
- Existencias históricas sin costo confiable marcadas como incompletas y conciliables con auditoría.
- Conteos físicos por bodega con fotografía inicial, bloqueo temporal de movimientos, registro por producto y cierre atómico.
- Diferencias de conteo convertidas en movimientos auditados sin perder un costo promedio ya conocido.
- Prueba real de conteo en Supabase: repetición segura, conflicto bloqueado, bodega congelada y cero datos temporales persistidos.
- Reservas de stock para ventas con entrega posterior, compatibles con los cupos POS y otras ventas pendientes.
- Liberación manual o por cancelación y consumo atómico al registrar la salida física.
- Prueba real de reservas en Supabase: reservar, liberar, volver a reservar, aplicar y repetir sin duplicar movimientos.
- Despacho móvil instalable con receptor, foto o firma, ubicación autorizada, evidencia privada y cola local persistente.
- Sincronización de entregas idempotente: reintentos seguros, conflicto de contenido bloqueado e incidencia cuando el despacho cambió.
- Prueba real de despacho en Supabase: inicio de ruta, entrega, evidencia, recibos idempotentes y repetición sin duplicados; cero datos temporales persistidos.
- Entregas parciales por producto, consumo proporcional de reservas y actualización separada de los estados de despacho, venta e inventario.
- Devolución física desde el despacho vinculada con una devolución formal de venta; la mercancía se reintegra una sola vez y los efectos financieros y fiscales quedan pendientes de confirmación independiente.
- Prueba real de entrega parcial y devolución en Supabase: 2 de 5 unidades entregadas, 1 devuelta, saldo neto de 1, repetición segura, contenido conflictivo bloqueado y cero datos temporales persistidos.
- POS sin conexión protegido contra sobreventa local acumulada: cada operación pendiente reduce el cupo visible y la reserva se comprueba dentro de la misma transacción que asigna su secuencia.
- Reapertura del POS sin red vinculada a la terminal seleccionada, bloqueo al vencer la autorización y sincronización del cupo local después de confirmar una venta.
- Listados operativos de inventario, movimientos, compras y despacho limitados a 50 registros por página, con orden estable y conteo total.
- Resúmenes de inventario, compras y despacho calculados en Supabase por empresa y permiso, sin descargar historiales completos al navegador.
- Búsqueda de productos para compras y ajustes limitada a 100 coincidencias por consulta, adecuada para catálogos de 10.000 productos.
- Índices de lectura por empresa, fecha e identificador activos en Supabase para sostener la paginación estable.
- Validación real por rol en producción: administrador y vendedor acceden a sus operaciones autorizadas; el repartidor solo ve Despacho y recibe “Acceso denegado” al abrir Inventario directamente.
- Verificación de corte actual: 259 pruebas aprobadas, lint sin errores, tipos correctos y compilación de producción completada.

## Criterio para actualizar el avance

Cada bloque aumenta únicamente cuando la funcionalidad:

1. está conectada al proceso anterior y posterior;
2. controla empresa, rol y módulo activo;
3. es idempotente cuando tiene efectos económicos o externos;
4. deja errores visibles y recuperables;
5. pasa pruebas locales, compilación y prueba transaccional en Supabase;
6. tiene pendientes comerciales o externos declarados.

## Ruta restante más corta

1. Ejecutar en paralelo la homologación externa de GTI, FacturaProfesional, Alegra, Meta y LinkedIn.
2. Cerrar facturación con pruebas reales por proveedor y tipo documental.
3. Completar y probar POS/PWA con varias terminales y contingencia fiscal.
4. Cerrar publicación multicanal y reportes trazables.
5. Reducir los paquetes iniciales más pesados, empezando por Brain, y ejecutar carga, restauración y seguridad integral.
6. Operar tres pilotos durante diez jornadas y resolver las incidencias que bloqueen venta.

RRHH se retomará como un bloque separado cuando esté aprobado su alcance ajustado.

El proyecto de Vercel está actualmente sujeto a la frecuencia diaria del plan Hobby. Los procesadores de integraciones y recordatorios quedan publicados y protegidos, pero su ejecución automática está programada una vez al día para que el despliegue sea válido. El criterio comercial de activación dentro de un minuto requiere cambiar el proyecto a Vercel Pro o conectar un programador externo equivalente antes del piloto.

La mayor incertidumbre de calendario está en accesos, contratos y revisiones externas. Sin esas cuentas, el código puede avanzar, pero los conectores no pueden declararse comercialmente comprobados.
