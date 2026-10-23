// Schema changes, applied in order and recorded in khatm._migrations.
// Money is in halalas, quantities in thousandths, both as integers.

export const migrations: { name: string; sql: string }[] = [
  {
    name: "001_init",
    sql: `
CREATE TABLE khatm.users (
  id text PRIMARY KEY,
  email text UNIQUE,
  password_hash text,
  name text,
  is_demo boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX users_demo_expiry ON khatm.users (expires_at) WHERE is_demo;

CREATE TABLE khatm.businesses (
  id text PRIMARY KEY,
  owner_id text NOT NULL UNIQUE REFERENCES khatm.users (id) ON DELETE CASCADE,
  name_ar text NOT NULL DEFAULT '',
  name_en text NOT NULL DEFAULT '',
  vat_number text,
  cr_number text,
  building_no text,
  street_ar text,
  street_en text,
  district_ar text,
  district_en text,
  city_ar text,
  city_en text,
  postal_code text,
  additional_no text,
  phone text,
  email text,
  iban text,
  bank_ar text,
  bank_en text,
  invoice_prefix text NOT NULL DEFAULT 'INV',
  credit_prefix text NOT NULL DEFAULT 'CRN',
  quote_prefix text NOT NULL DEFAULT 'QUO',
  next_invoice integer NOT NULL DEFAULT 1,
  next_credit integer NOT NULL DEFAULT 1,
  next_quote integer NOT NULL DEFAULT 1,
  terms_days integer NOT NULL DEFAULT 14 CHECK (terms_days BETWEEN 0 AND 365),
  notes_ar text,
  notes_en text,
  -- Whether issued documents carry the business's round seal.
  stamp boolean NOT NULL DEFAULT true,
  timezone text NOT NULL DEFAULT 'Asia/Riyadh',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE khatm.customers (
  id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES khatm.businesses (id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'business' CHECK (kind IN ('business', 'person')),
  name_ar text NOT NULL DEFAULT '',
  name_en text NOT NULL DEFAULT '',
  vat_number text,
  cr_number text,
  building_no text,
  street_ar text,
  street_en text,
  district_ar text,
  district_en text,
  city_ar text,
  city_en text,
  postal_code text,
  additional_no text,
  country text NOT NULL DEFAULT 'SA',
  email text,
  phone text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customers_business ON khatm.customers (business_id);

CREATE TABLE khatm.products (
  id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES khatm.businesses (id) ON DELETE CASCADE,
  name_ar text NOT NULL DEFAULT '',
  name_en text NOT NULL DEFAULT '',
  unit_ar text,
  unit_en text,
  price integer NOT NULL CHECK (price >= 0),
  vat text NOT NULL DEFAULT 'S' CHECK (vat IN ('S', 'Z', 'E', 'O')),
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_business ON khatm.products (business_id);

-- Invoices (tax and simplified), credit notes and quotations.
CREATE TABLE khatm.documents (
  id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES khatm.businesses (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('tax', 'simplified', 'credit', 'quote')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'void')),
  number text,
  customer_id text REFERENCES khatm.customers (id) ON DELETE SET NULL,
  -- Frozen copies of both parties at issue, so later edits can't change an issued document.
  seller jsonb,
  buyer jsonb,
  issue_date date,
  supply_date date,
  due_date date,
  issued_at timestamptz,
  reference_id text REFERENCES khatm.documents (id) ON DELETE SET NULL,
  reason_ar text,
  reason_en text,
  notes_ar text,
  notes_en text,
  gross integer NOT NULL DEFAULT 0,
  discount integer NOT NULL DEFAULT 0,
  taxable integer NOT NULL DEFAULT 0,
  vat integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  qr text,
  share_token text UNIQUE,
  viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status = 'draft' OR number IS NOT NULL)
);
CREATE UNIQUE INDEX documents_number ON khatm.documents (business_id, number) WHERE number IS NOT NULL;
CREATE INDEX documents_list ON khatm.documents (business_id, kind, status, issue_date DESC);
CREATE INDEX documents_reference ON khatm.documents (reference_id) WHERE reference_id IS NOT NULL;

CREATE TABLE khatm.lines (
  id text PRIMARY KEY,
  document_id text NOT NULL REFERENCES khatm.documents (id) ON DELETE CASCADE,
  sort integer NOT NULL DEFAULT 0,
  product_id text REFERENCES khatm.products (id) ON DELETE SET NULL,
  name_ar text NOT NULL DEFAULT '',
  name_en text NOT NULL DEFAULT '',
  unit_ar text,
  unit_en text,
  qty_milli integer NOT NULL CHECK (qty_milli > 0),
  unit_price integer NOT NULL CHECK (unit_price >= 0),
  discount_bps integer NOT NULL DEFAULT 0 CHECK (discount_bps BETWEEN 0 AND 10000),
  vat text NOT NULL CHECK (vat IN ('S', 'Z', 'E', 'O')),
  vat_bps integer NOT NULL,
  net integer NOT NULL,
  vat_amount integer NOT NULL,
  total integer NOT NULL
);
CREATE INDEX lines_document ON khatm.lines (document_id, sort);

CREATE TABLE khatm.payments (
  id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES khatm.businesses (id) ON DELETE CASCADE,
  document_id text NOT NULL REFERENCES khatm.documents (id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount > 0),
  paid_on date NOT NULL,
  method text NOT NULL DEFAULT 'transfer' CHECK (method IN ('transfer', 'cash', 'card', 'other')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_document ON khatm.payments (document_id);
CREATE INDEX payments_business ON khatm.payments (business_id, paid_on);

CREATE TABLE khatm.attempts (
  key text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX attempts_key ON khatm.attempts (key, at);

CREATE TABLE khatm.app_jobs (
  key text PRIMARY KEY,
  ran_at timestamptz NOT NULL
);
`,
  },
];
