// Drizzle's view of the tables created in migrations.ts (the SQL there is the source of truth).
import { boolean, date, integer, jsonb, pgSchema, text, timestamp } from "drizzle-orm/pg-core";
import type { VatCategory } from "@/lib/zatca";

export const khatm = pgSchema("khatm");
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const day = (name: string) => date(name, { mode: "string" });

export const users = khatm.table("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  passwordHash: text("password_hash"),
  name: text("name"),
  isDemo: boolean("is_demo").notNull(),
  expiresAt: ts("expires_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

const address = {
  buildingNo: text("building_no"),
  streetAr: text("street_ar"),
  streetEn: text("street_en"),
  districtAr: text("district_ar"),
  districtEn: text("district_en"),
  cityAr: text("city_ar"),
  cityEn: text("city_en"),
  postalCode: text("postal_code"),
  additionalNo: text("additional_no"),
};

export const businesses = khatm.table("businesses", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  vatNumber: text("vat_number"),
  crNumber: text("cr_number"),
  ...address,
  phone: text("phone"),
  email: text("email"),
  iban: text("iban"),
  bankAr: text("bank_ar"),
  bankEn: text("bank_en"),
  invoicePrefix: text("invoice_prefix").notNull(),
  creditPrefix: text("credit_prefix").notNull(),
  quotePrefix: text("quote_prefix").notNull(),
  nextInvoice: integer("next_invoice").notNull(),
  nextCredit: integer("next_credit").notNull(),
  nextQuote: integer("next_quote").notNull(),
  termsDays: integer("terms_days").notNull(),
  notesAr: text("notes_ar"),
  notesEn: text("notes_en"),
  stamp: boolean("stamp").notNull().default(true),
  timezone: text("timezone").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const customers = khatm.table("customers", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull(),
  kind: text("kind").$type<"business" | "person">().notNull(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  vatNumber: text("vat_number"),
  crNumber: text("cr_number"),
  ...address,
  country: text("country").notNull(),
  email: text("email"),
  phone: text("phone"),
  archived: boolean("archived").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const products = khatm.table("products", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  unitAr: text("unit_ar"),
  unitEn: text("unit_en"),
  price: integer("price").notNull(),
  vat: text("vat").$type<VatCategory>().notNull(),
  archived: boolean("archived").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export type DocKind = "tax" | "simplified" | "credit" | "quote";
export type DocStatus = "draft" | "issued" | "void";

/** A party as printed on a document, frozen when it's issued. */
export type Party = {
  nameAr: string;
  nameEn: string;
  vatNumber: string | null;
  crNumber: string | null;
  buildingNo: string | null;
  streetAr: string | null;
  streetEn: string | null;
  districtAr: string | null;
  districtEn: string | null;
  cityAr: string | null;
  cityEn: string | null;
  postalCode: string | null;
  additionalNo: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  iban?: string | null;
  bankAr?: string | null;
  bankEn?: string | null;
};

export const documents = khatm.table("documents", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull(),
  kind: text("kind").$type<DocKind>().notNull(),
  status: text("status").$type<DocStatus>().notNull(),
  number: text("number"),
  customerId: text("customer_id"),
  seller: jsonb("seller").$type<Party>(),
  buyer: jsonb("buyer").$type<Party>(),
  issueDate: day("issue_date"),
  supplyDate: day("supply_date"),
  dueDate: day("due_date"),
  issuedAt: ts("issued_at"),
  referenceId: text("reference_id"),
  reasonAr: text("reason_ar"),
  reasonEn: text("reason_en"),
  notesAr: text("notes_ar"),
  notesEn: text("notes_en"),
  gross: integer("gross").notNull(),
  discount: integer("discount").notNull(),
  taxable: integer("taxable").notNull(),
  vat: integer("vat").notNull(),
  total: integer("total").notNull(),
  qr: text("qr"),
  shareToken: text("share_token"),
  viewedAt: ts("viewed_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const lines = khatm.table("lines", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull(),
  sort: integer("sort").notNull(),
  productId: text("product_id"),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  unitAr: text("unit_ar"),
  unitEn: text("unit_en"),
  qtyMilli: integer("qty_milli").notNull(),
  unitPrice: integer("unit_price").notNull(),
  discountBps: integer("discount_bps").notNull(),
  vat: text("vat").$type<VatCategory>().notNull(),
  vatBps: integer("vat_bps").notNull(),
  net: integer("net").notNull(),
  vatAmount: integer("vat_amount").notNull(),
  total: integer("total").notNull(),
});

export type PayMethod = "transfer" | "cash" | "card" | "other";

export const payments = khatm.table("payments", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull(),
  documentId: text("document_id").notNull(),
  amount: integer("amount").notNull(),
  paidOn: day("paid_on").notNull(),
  method: text("method").$type<PayMethod>().notNull(),
  note: text("note"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const attempts = khatm.table("attempts", {
  key: text("key").notNull(),
  at: ts("at").notNull(),
});

export type User = typeof users.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Doc = typeof documents.$inferSelect;
export type Line = typeof lines.$inferSelect;
export type Payment = typeof payments.$inferSelect;
