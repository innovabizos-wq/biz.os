import type {
  InboxAssignableUser,
  InboxConversation,
  InboxCustomer,
  InboxMessage,
} from "@/modules/inbox/types";

export type InboxWidgetConversation = InboxConversation & {
  etiquetas: string[];
  etapaFunnel: string | null;
};
export type InboxWidgetMessage = InboxMessage;

export type InboxWidgetOperations = {
  canAssign: boolean;
  canChangeStatus: boolean;
  canReply: boolean;
  customers: InboxCustomer[];
  users: InboxAssignableUser[];
};

export type InboxWidgetView = "list" | "chat";
