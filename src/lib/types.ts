export type Lang = "ar" | "en";
export type { DocKind, DocStatus, Party, PayMethod } from "@/db/schema";
export type { VatCategory } from "./zatca";

/** What a list or a dashboard shows about a document, with its money worked out. */
export type DocSummary = {
  id: string;
  kind: import("@/db/schema").DocKind;
  status: import("@/db/schema").DocStatus;
  number: string | null;
  customerName: { ar: string; en: string } | null;
  issueDate: string | null;
  dueDate: string | null;
  total: number;
  paid: number;
  credited: number;
  balance: number;
  state: DocState;
};

/** The status people see: drafts, what's owed, what's late, what's settled. */
export type DocState = "draft" | "unpaid" | "partial" | "overdue" | "paid" | "credited" | "void" | "sent" | "accepted" | "issued";
