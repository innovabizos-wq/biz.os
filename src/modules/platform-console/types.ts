import type {
  PLATFORM_CONSOLE_ROLES,
  PLATFORM_CONSOLE_STATUSES,
} from "@/modules/platform-console/constants";
import type { EmpresaEstado, JsonRecord, ModuleCode } from "@/types/core";

export type PlatformRole = (typeof PLATFORM_CONSOLE_ROLES)[number];
export type PlatformUserStatus = (typeof PLATFORM_CONSOLE_STATUSES)[number];

export type PlatformUser = {
  createdAt: string;
  email: string | null;
  id: string;
  name: string;
  notes: string | null;
  profileId: string;
  role: PlatformRole;
  status: PlatformUserStatus;
};

export type PlatformSummary = {
  activeCompanies: number;
  companies: number;
  healthErrors: number;
  integrationErrors: number;
  latestCompanies: PlatformCompanyListItem[];
  latestHealthErrors: PlatformHealthItem[];
  suspendedCompanies: number;
  whappPendingChannels: number;
};

export type PlatformCompanyListItem = {
  activeModules: number;
  createdAt: string;
  healthStatus: "healthy" | "issues" | "unknown";
  id: string;
  name: string;
  planName: string | null;
  status: EmpresaEstado;
  users: number;
};

export type PlatformCompanyDetail = {
  activeModules: PlatformCompanyModule[];
  billingHealth: PlatformBillingHealth | null;
  company: {
    createdAt: string;
    email: string | null;
    fiscalId: string | null;
    id: string;
    name: string;
    phone: string | null;
    status: EmpresaEstado;
    tradeName: string | null;
    updatedAt: string;
  };
  health: PlatformHealthItem[];
  plan: {
    code: string | null;
    name: string | null;
    status: string | null;
  };
  recentActivity: PlatformActivityItem[];
  users: PlatformCompanyUser[];
};

export type PlatformBillingHealth = {
  artifactCounts: JsonRecord;
  billingConfigStatus: string | null;
  certificatePresent: boolean;
  configurationComplete: boolean;
  credentialsPresent: boolean;
  documentCounts: JsonRecord;
  lastError: string | null;
  lastHaciendaStatus: string | null;
  lastReceivedValidationErrors: unknown[];
  receivedArtifactCounts: JsonRecord;
  receivedDocumentCounts: JsonRecord;
};

export type PlatformCompanyModule = {
  code: ModuleCode | string;
  healthStatus: string | null;
  isCore: boolean;
  name: string;
  softDependencies: readonly ModuleCode[];
  status: string;
};

export type PlatformCompanyUser = {
  email: string;
  id: string;
  name: string;
  roleName: string | null;
  status: string;
};

export type PlatformHealthItem = {
  companyId: string;
  companyName: string | null;
  configurationComplete: boolean;
  credentialsPresent: boolean;
  lastError: string | null;
  lastErrorAt: string | null;
  metadata: JsonRecord;
  moduleCode: string;
  status: string;
};

export type PlatformActivityItem = {
  createdAt: string;
  description: string;
  kind: string;
};

export type PlatformWhappChannel = {
  channelId: string;
  companyId: string;
  companyName: string | null;
  connectionStatus: string;
  healthStatus: string | null;
  lastError: string | null;
  lastEventAt: string | null;
  name: string;
  phoneNumberId: string | null;
  provider: string;
  publicConfig: JsonRecord;
  status: string;
  wabaId: string | null;
  webhookUrl: string | null;
};
