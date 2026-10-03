"use client";

import { useState } from "react";

import {
  createMetaChannelAction,
  updateMetaChannelConfigAction,
} from "@/modules/inbox/actions";
import {
  INBOX_CHANNEL_LABELS,
  INBOX_CONNECTION_STATUSES,
  INBOX_META_CHANNELS,
} from "@/modules/inbox/constants";
import type { InboxChannelConfig, InboxMetaChannel } from "@/modules/inbox/types";
import { Button } from "@/components/ui/button";

type InboxMetaChannelFormProps = {
  channel?: InboxChannelConfig;
  mode: "create" | "update";
};

const channelFieldHelp: Record<
  InboxMetaChannel,
  {
    description: string;
    fields: Array<{
      help: string;
      key: string;
      label: string;
      name: string;
      placeholder: string;
      required?: boolean;
    }>;
  }
> = {
  facebook: {
    description: "Conecta una pagina de Facebook para Messenger.",
    fields: [
      {
        help: "ID de la pagina que recibira mensajes.",
        key: "page_id",
        label: "Page ID",
        name: "pageId",
        placeholder: "Ej. 1234567890",
        required: true,
      },
      {
        help: "ID de la app Meta usada para esta conexion.",
        key: "app_id",
        label: "App ID",
        name: "appId",
        placeholder: "Ej. 9876543210",
        required: true,
      },
      {
        help: "Opcional, ID del Business Manager.",
        key: "business_id",
        label: "Business ID",
        name: "businessId",
        placeholder: "Opcional",
      },
    ],
  },
  instagram: {
    description: "Conecta una cuenta profesional de Instagram vinculada a pagina.",
    fields: [
      {
        help: "ID de la cuenta profesional de Instagram.",
        key: "instagram_business_account_id",
        label: "Instagram Business Account ID",
        name: "instagramBusinessAccountId",
        placeholder: "Ej. 1784...",
        required: true,
      },
      {
        help: "Pagina vinculada a la cuenta profesional.",
        key: "page_id",
        label: "Page ID",
        name: "pageId",
        placeholder: "Ej. 1234567890",
        required: true,
      },
      {
        help: "ID de la app Meta usada para esta conexion.",
        key: "app_id",
        label: "App ID",
        name: "appId",
        placeholder: "Ej. 9876543210",
        required: true,
      },
      {
        help: "Opcional, ID del Business Manager.",
        key: "business_id",
        label: "Business ID",
        name: "businessId",
        placeholder: "Opcional",
      },
    ],
  },
  whatsapp: {
    description: "Conecta un numero de WhatsApp Business Cloud API por empresa.",
    fields: [
      {
        help: "ID del numero en WhatsApp Manager. Es el dato clave para mapear mensajes entrantes.",
        key: "phone_number_id",
        label: "Phone Number ID",
        name: "phoneNumberId",
        placeholder: "Ej. 123456789012345",
        required: true,
      },
      {
        help: "ID de la cuenta WhatsApp Business.",
        key: "waba_id",
        label: "WABA ID",
        name: "wabaId",
        placeholder: "Ej. 987654321098765",
        required: true,
      },
      {
        help: "ID de la app Meta usada para webhooks y permisos.",
        key: "app_id",
        label: "App ID",
        name: "appId",
        placeholder: "Ej. 1122334455",
        required: true,
      },
      {
        help: "Opcional, ID del Business Manager.",
        key: "business_id",
        label: "Business ID",
        name: "businessId",
        placeholder: "Opcional",
      },
    ],
  },
};

function getConfigText(channel: InboxChannelConfig | undefined, key: string) {
  const value = channel?.configuracionPublica[key];
  return typeof value === "string" ? value : "";
}

function getChannelValue(channel: InboxChannelConfig | undefined): InboxMetaChannel {
  return channel?.canal === "facebook" ||
    channel?.canal === "instagram" ||
    channel?.canal === "whatsapp"
    ? channel.canal
    : "whatsapp";
}

function getWhatsAppAccountModel(channel: InboxChannelConfig | undefined) {
  return channel?.configuracionPublica.whatsapp_account_model === "shared_waac_pma"
    ? "shared_waac_pma"
    : "legacy_waba";
}

function getAutomationOwner(channel: InboxChannelConfig | undefined) {
  const owner = channel?.configuracionPublica.automation_owner;

  return owner === "external" || owner === "manual" ? owner : "bizos";
}

export function InboxMetaChannelForm({
  channel,
  mode,
}: InboxMetaChannelFormProps) {
  const action =
    mode === "create" ? createMetaChannelAction : updateMetaChannelConfigAction;
  const initialChannel = getChannelValue(channel);
  const [selectedChannel, setSelectedChannel] =
    useState<InboxMetaChannel>(initialChannel);
  const [whatsappAccountModel, setWhatsappAccountModel] = useState<
    "legacy_waba" | "shared_waac_pma"
  >(getWhatsAppAccountModel(channel));
  const selectedHelp = channelFieldHelp[selectedChannel];

  return (
    <form action={action} className="rounded-lg border bg-background p-5">
      {channel ? <input name="canalId" type="hidden" value={channel.id} /> : null}
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Canal Meta</span>
          <select
            className="h-9 w-full rounded-md border bg-background px-3"
            disabled={mode === "update"}
            name="canal"
            onChange={(event) =>
              setSelectedChannel(event.target.value as InboxMetaChannel)
            }
            value={selectedChannel}
          >
            {INBOX_META_CHANNELS.map((item) => (
              <option key={item} value={item}>
                {INBOX_CHANNEL_LABELS[item]}
              </option>
            ))}
          </select>
          {mode === "update" ? (
            <input name="canal" type="hidden" value={selectedChannel} />
          ) : null}
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-medium">Nombre visible</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            defaultValue={channel?.nombre ?? ""}
            name="nombre"
            placeholder="Ej. WhatsApp Ventas"
            required
          />
        </label>
      </div>

      <div className="mt-4 rounded-md border bg-muted/50 p-3 text-sm">
        <p className="font-semibold">{selectedHelp.description}</p>
        <p className="mt-1 text-muted-foreground">
          Completa solo los campos necesarios para este canal. Los secretos se
          guardan aparte y nunca se muestran completos.
        </p>
      </div>

      <input
        name="identificadorExterno"
        type="hidden"
        value={
          selectedChannel === "whatsapp"
            ? getConfigText(channel, "phone_number_id")
            : selectedChannel === "instagram"
              ? getConfigText(channel, "instagram_business_account_id")
              : getConfigText(channel, "page_id")
        }
      />

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {selectedHelp.fields.map((field) => {
          const required =
            field.key === "waba_id" && selectedChannel === "whatsapp"
              ? whatsappAccountModel === "legacy_waba"
              : field.required;

          return (
            <label className="space-y-1 text-sm" key={field.name}>
              <span className="font-medium">
                {field.label}
                {required ? <span className="text-destructive"> *</span> : null}
              </span>
              <input
                className="h-9 w-full rounded-md border bg-background px-3"
                defaultValue={getConfigText(channel, field.key)}
                name={field.name}
                placeholder={field.placeholder}
                required={required}
              />
              <span className="block text-xs text-muted-foreground">
                {field.help}
              </span>
            </label>
          );
        })}
      </div>

      {selectedChannel === "whatsapp" ? (
        <section className="mt-4 rounded-lg border bg-muted/30 p-4">
          <div>
            <p className="font-semibold">Modelo de cuenta WhatsApp</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Usa "numero compartido" solo cuando Meta haya autorizado este
              mismo numero para biz.os y otro proveedor, como Callbell.
            </p>
          </div>

          <label className="mt-4 block space-y-1 text-sm">
            <span className="font-medium">Uso del numero</span>
            <select
              className="h-9 w-full rounded-md border bg-background px-3 md:w-96"
              name="whatsappAccountModel"
              onChange={(event) =>
                setWhatsappAccountModel(
                  event.target.value as "legacy_waba" | "shared_waac_pma",
                )
              }
              value={whatsappAccountModel}
            >
              <option value="legacy_waba">Cuenta WABA tradicional</option>
              <option value="shared_waac_pma">
                Numero compartido entre proveedores (WAAC / PMA)
              </option>
            </select>
          </label>

          {whatsappAccountModel === "shared_waac_pma" ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">
                  WAAC ID <span className="text-destructive">*</span>
                </span>
                <input
                  className="h-9 w-full rounded-md border bg-background px-3"
                  defaultValue={getConfigText(channel, "waac_id")}
                  name="waacId"
                  placeholder="ID de la WhatsApp Account compartida"
                  required
                />
                <span className="block text-xs text-muted-foreground">
                  Identifica el numero compartido que Meta autorizo.
                </span>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">
                  PMA ID de biz.os <span className="text-destructive">*</span>
                </span>
                <input
                  className="h-9 w-full rounded-md border bg-background px-3"
                  defaultValue={getConfigText(channel, "pma_id")}
                  name="pmaId"
                  placeholder="Cuenta de mensajeria que factura biz.os"
                  required
                />
                <span className="block text-xs text-muted-foreground">
                  Se usa para atribuir a biz.os sus costos de mensajeria.
                </span>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Proveedor adicional</span>
                <input
                  className="h-9 w-full rounded-md border bg-background px-3"
                  defaultValue={getConfigText(channel, "external_partner")}
                  name="externalPartner"
                  placeholder="Ej. Callbell"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Quien controla automatizaciones</span>
                <select
                  className="h-9 w-full rounded-md border bg-background px-3"
                  defaultValue={getAutomationOwner(channel)}
                  name="automationOwner"
                >
                  <option value="bizos">biz.os</option>
                  <option value="external">Proveedor adicional</option>
                  <option value="manual">Solo equipo humano</option>
                </select>
                <span className="block text-xs text-muted-foreground">
                  Si no es biz.os, las campanas quedan bloqueadas para evitar
                  envios duplicados.
                </span>
              </label>
            </div>
          ) : null}
        </section>
      ) : null}

      {mode === "update" ? (
        <label className="mt-4 block space-y-1 text-sm">
          <span className="font-medium">Estado de conexion</span>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 md:w-64"
            defaultValue={channel?.conexionEstado ?? "pendiente"}
            name="conexionEstado"
          >
            {INBOX_CONNECTION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <Button className="mt-4" type="submit">
        {mode === "create" ? "Crear canal Meta" : "Guardar configuracion"}
      </Button>
    </form>
  );
}
