CREATE TYPE public.faq_page AS ENUM (
    'home',
    'apply',
    'account'
);

CREATE TABLE faqs (
  id SERIAL PRIMARY KEY,
  page public.faq_page NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  updated_by INTEGER REFERENCES members(member_id),
  display_order INTEGER DEFAULT 0
);

CREATE INDEX idx_faqs_page ON faqs(page);
CREATE INDEX idx_faqs_display_order ON faqs(display_order);
