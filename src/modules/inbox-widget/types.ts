import type {
  InboxAssignableUser,
  InboxConversation,
  InboxCustomer,
  InboxMessage,
} from "@/modules/inbox/types";

export type InboxWidgetConversation = InboxConversation & {
  etiquetas: string[];
  etapaFunnel: string | null;
  clienteNumero: number | null;
};
export type InboxWidgetMessage = InboxMessage;

export type InboxWidgetCustomer = InboxCustomer & {
  numero: number;
};

export type InboxWidgetOperations = {
  availableTags: Array<{ color: string; id: string; nombre: string }>;
  canAssign: boolean;
  canChangeStatus: boolean;
  canCreateCustomer: boolean;
  canReply: boolean;
  currentProfileId: string | null;
  currentProfileName: string | null;
  customers: InboxWidgetCustomer[];
  funnelStages: Array<{
    color: string;
    funnelId: string;
    funnelName: string;
    id: string;
    nombre: string;
  }>;
  users: InboxAssignableUser[];
};

export type InboxWidgetView = "list" | "chat";
