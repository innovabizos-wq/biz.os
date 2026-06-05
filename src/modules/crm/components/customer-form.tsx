import {
  CRM_CLIENTE_ESTADOS,
  CRM_CLIENTE_GENEROS,
  CRM_CLIENTE_TIPOS,
} from "@/modules/crm/constants";
import { createCustomerAction, updateCustomerAction } from "@/modules/crm/actions";
import type { CrmAssignableUser, CrmCustomer } from "@/modules/crm/types";
import { Button } from "@/components/ui/button";

type CustomerFormProps = {
  assignableUsers: CrmAssignableUser[];
  customer?: CrmCustomer;
  mode: "create" | "update";
};

const generoLabels: Record<(typeof CRM_CLIENTE_GENEROS)[number], string> = {
  h: "H - Hombre",
  m: "M - Mujer",
  o: "Otro",
};

export function CustomerForm({
  assignableUsers,
  customer,
  mode,
}: CustomerFormProps) {
  const isUpdate = mode === "update";

  return (
    <form
      action={isUpdate ? updateCustomerAction : createCustomerAction}
      className="grid gap-4 rounded-lg border bg-background p-5 shadow-sm"
    >
      {customer ? <input name="clienteId" type="hidden" value={customer.id} /> : null}
      <div>
        <h3 className="text-base font-semibold">
          {isUpdate ? "Datos comerciales" : "Nuevo cliente/prospecto"}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          La empresa se resuelve desde la sesion. No se solicita empresa_id.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2 text-sm font-medium">
          Tipo
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={customer?.tipo ?? "prospecto"}
            name="tipo"
            required
          >
            {CRM_CLIENTE_TIPOS.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </label>

        {isUpdate ? (
          <label className="space-y-2 text-sm font-medium">
            Estado
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              defaultValue={customer?.estado ?? "nuevo"}
              name="estado"
              required
            >
              {CRM_CLIENTE_ESTADOS.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="space-y-2 text-sm font-medium">
          Asignado a
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={customer?.asignadoA ?? ""}
            name="asignadoA"
          >
            <option value="">Sin asignar</option>
            {assignableUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm font-medium">
          Genero
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={customer?.genero ?? "o"}
            name="genero"
            required
          >
            {CRM_CLIENTE_GENEROS.map((genero) => (
              <option key={genero} value={genero}>
                {generoLabels[genero]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          Nombre
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={customer?.nombre}
            name="nombre"
            required
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Identificacion
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={customer?.identificacion ?? ""}
            name="identificacion"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2 text-sm font-medium">
          Telefono
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={customer?.telefono ?? ""}
            name="telefono"
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          WhatsApp
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={customer?.whatsapp ?? ""}
            name="whatsapp"
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Correo
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={customer?.correo ?? ""}
            name="correo"
            type="email"
          />
        </label>
      </div>

      <label className="space-y-2 text-sm font-medium">
        Origen
        <input
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          defaultValue={customer?.origen ?? ""}
          name="origen"
        />
      </label>

      <label className="space-y-2 text-sm font-medium">
        Notas
        <textarea
          className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
          defaultValue={customer?.notas ?? ""}
          name="notas"
        />
      </label>

      <Button className="w-fit" type="submit">
        {isUpdate ? "Guardar cliente" : "Crear cliente"}
      </Button>
    </form>
  );
}
