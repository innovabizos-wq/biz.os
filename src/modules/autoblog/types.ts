export type AutoblogStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "ready_to_publish"
  | "archived";

export type AutoblogSourceMode =
  | "manual"
  | "news"
  | "trend"
  | "internal_context";

export type AutoblogTopicStatus = "new" | "selected" | "used" | "discarded";

export type AutoblogArticle = {
  approvedAt: string | null;
  approvedBy: string | null;
  content: string;
  createdAt: string;
  createdBy: string | null;
  cta: string | null;
  id: string;
  keywords: string | null;
  readyToPublishAt: string | null;
  scheduledFor: string | null;
  seoDescription: string | null;
  seoTitle: string | null;
  slug: string | null;
  socialFacebook: string | null;
  socialInstagram: string | null;
  socialLinkedin: string | null;
  socialWhatsapp: string | null;
  sourceMode: AutoblogSourceMode;
  sourceNotes: string | null;
  sourceUrls: string[];
  status: AutoblogStatus;
  summary: string | null;
  title: string;
  topic: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

export type AutoblogTopic = {
  createdAt: string;
  createdBy: string | null;
  description: string | null;
  id: string;
  relevanceScore: number | null;
  sourceMode: AutoblogSourceMode;
  sourceUrls: string[];
  status: AutoblogTopicStatus;
  title: string;
};

export type AutoblogDraft = {
  content: string;
  cta: string | null;
  keywords: string | null;
  seoDescription: string | null;
  seoTitle: string | null;
  socialFacebook: string | null;
  socialInstagram: string | null;
  socialLinkedin: string | null;
  socialWhatsapp: string | null;
  summary: string | null;
  title: string;
};
