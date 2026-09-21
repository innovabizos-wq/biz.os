"use client";

import dynamic from "next/dynamic";

const BrainChat = dynamic(
  () => import("@/modules/brain/components/brain-chat").then((module) => module.BrainChat),
  {
    loading: () => <div className="dashboard-ai-search dashboard-topbar-reserved" />,
    ssr: false,
  },
);

export type DashboardAiSearchCapabilities = {
  canCreateCustomer: boolean;
  canCreateProduct: boolean;
  canCreateQuote: boolean;
  showAdmin: boolean;
  showAgenda: boolean;
  showAutoblog: boolean;
  showBilling: boolean;
  showBrain: boolean;
  showCatalog: boolean;
  showCrm: boolean;
  showDispatch: boolean;
  showHr: boolean;
  showInbox: boolean;
  showInventory: boolean;
  showPayments: boolean;
  showPurchases: boolean;
  showQuotes: boolean;
  showSales: boolean;
};

export function DashboardAiSearch(capabilities: DashboardAiSearchCapabilities) {
  void capabilities;
  return <BrainChat variant="bar" />;
}
