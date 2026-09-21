# Integridad de pagos

Los cobros y pagos manuales usan `registrar_movimiento_cuenta_idempotente`. La interfaz y Business Brain comparten este contrato para evitar que un doble clic, una reconexión o la recuperación de una ejecución creen dos movimientos.

Cada intento incluye un identificador de operación. La base bloquea intentos concurrentes con el mismo identificador, guarda el saldo y estado producidos por la primera ejecución y devuelve ese resultado en repeticiones equivalentes. Si el identificador se reutiliza con otra cuenta, importe, método, referencia o notas, la operación se rechaza como conflicto.

Los métodos admitidos son efectivo, tarjeta, SINPE, transferencia y otro. Tarjeta, SINPE y transferencia requieren una referencia. El saldo de la cuenta se bloquea dentro de la transacción y no se permiten sobrepagos.

La lista de movimientos ya no convierte un fallo de consulta en una lista vacía. La pantalla informa que los movimientos y sus totales están incompletos hasta que la consulta pueda recuperarse.

## Verificación operativa

1. Registrar un abono con un identificador nuevo y comprobar que existe un solo movimiento.
2. Repetir la misma solicitud y comprobar que devuelve el mismo movimiento, saldo y estado con `replayed = true`.
3. Reutilizar el identificador con otro importe y comprobar que se rechaza.
4. Intentar un sobrepago y comprobar que no se crea el movimiento.
5. Confirmar que `anon` y `service_role` sin sesión de usuario no pueden ejecutar el RPC interactivo.
