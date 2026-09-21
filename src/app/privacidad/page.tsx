export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <article className="space-y-8 rounded-2xl border bg-background p-8 shadow-sm">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">biz.os</p>
          <h1 className="mt-2 text-3xl font-bold">Politica de privacidad</h1>
          <p className="mt-3 text-sm text-muted-foreground">Ultima actualizacion: 14 de agosto de 2026.</p>
        </header>
        <section>
          <h2 className="text-xl font-semibold">Datos utilizados</h2>
          <p className="mt-2 text-muted-foreground">Procesamos identificadores de cuentas y paginas autorizadas, mensajes, archivos, estados de entrega y datos de contacto necesarios para operar Inbox y Whapp.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold">Finalidad y acceso</h2>
          <p className="mt-2 text-muted-foreground">Los datos se usan para gestionar conversaciones, atender clientes, registrar consentimiento, ejecutar automatizaciones autorizadas y medir costos. Solo usuarios autorizados del negocio pueden acceder a ellos.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold">Conservacion y seguridad</h2>
          <p className="mt-2 text-muted-foreground">Las credenciales se almacenan como secretos del servidor. Conservamos los datos mientras la cuenta los necesite o exista una obligacion legal, y registramos eventos sensibles para auditoria.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold">Control del usuario</h2>
          <p className="mt-2 text-muted-foreground">Las personas pueden solicitar dejar de recibir mensajes. Los administradores pueden desconectar canales y Meta puede ejecutar la eliminacion firmada de credenciales y autorizaciones mediante el endpoint configurado para la app.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold">Contacto</h2>
          <p className="mt-2 text-muted-foreground">Para solicitudes de privacidad, utiliza el canal de soporte publicado por el negocio que te contacto mediante biz.os.</p>
        </section>
      </article>
    </main>
  );
}
