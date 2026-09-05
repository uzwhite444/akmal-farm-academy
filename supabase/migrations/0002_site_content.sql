-- Akmal Farm — Taklifnoma :: tahrirlanadigan sayt kontenti (CMS)
-- Bitta qatorli JSONB jadval — admin panel shu yerni yangilaydi,
-- ochiq sayt esa GET /api/content orqali o'qiydi.

create table if not exists public.site_content (
  id         int primary key default 1,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint site_content_singleton check (id = 1)
);

comment on table public.site_content is 'Akmal Farm taklifnoma — admin panel orqali tahrirlanadigan matnlar (JSONB, bitta qator)';

-- RLS yoqilgan, hech qanday public policy yo'q — faqat Edge/Serverless
-- funksiyalar (service_role kaliti bilan) o'qiydi/yozadi.
alter table public.site_content enable row level security;

insert into public.site_content (id, data, updated_by)
values (1, '{
  "hero": {
    "title_uz": "YANGI DORIXONA OCHILISHI",
    "title_ru": "Открытие новой аптеки",
    "lead_uz": "Hurmatli mehmon! Sizni «Akmal Farm» tarmogʻining Qoʻrgʻontepadagi yangi filiali ochilish marosimiga taklif etamiz.",
    "lead_ru": "Уважаемый гость! Приглашаем Вас на открытие нового филиала сети «Akmal Farm» в Кургантепа."
  },
  "event": {
    "date_uz": "2-iyul 2026",
    "date_ru": "2 июля 2026",
    "time_uz": "soat 11:00",
    "time_ru": "11:00",
    "countdown_target_iso": "2026-07-02T11:00:00+05:00",
    "address_uz": "Andijon vil., Qoʻrgʻontepa t., Yuksalish MFY, Mustaqillik koʻchasi, 972-uy",
    "address_ru": "Андижанская обл., Кургантепа, махалля Юксалиш, ул. Мустакиллик, 972",
    "map_url": "https://maps.app.goo.gl/7EqAj59EHxSWTrHJ6"
  },
  "footer": {
    "sign_uz": "HURMAT BILAN, AKMAL FARM",
    "sign_ru": "С уважением, Akmal Farm",
    "phone": "1080",
    "site": "akmalfarm.uz"
  },
  "meta": {
    "page_title": "Akmal Farm — Taklifnoma"
  }
}'::jsonb, 'seed')
on conflict (id) do nothing;

-- Login urinishlari (bruteforce'dan himoya, RSVP anti-spam bilan bir xil naqsh)
create table if not exists public.admin_login_attempts (
  id         uuid primary key default gen_random_uuid(),
  ip_hash    text not null,
  username   text,
  success    boolean not null,
  created_at timestamptz not null default now()
);
alter table public.admin_login_attempts enable row level security;
create index if not exists admin_login_attempts_ip_idx on public.admin_login_attempts (ip_hash, created_at desc);
