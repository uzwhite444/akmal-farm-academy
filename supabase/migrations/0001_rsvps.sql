-- Akmal Farm — ochilish marosimi :: mehmonlar javoblari (RSVP)
-- Открытие филиала :: ответы гостей

create extension if not exists pgcrypto;

create table if not exists public.rsvps (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null,
  phone      text        not null,
  attending  boolean     not null,
  guests     integer     not null default 0,
  message    text,
  ip_hash    text,                         -- SHA-256(ip + salt) — anti-spam uchun, xufyona emas
  created_at timestamptz not null default now()
);

comment on table public.rsvps is 'Akmal Farm ochilish marosimi — mehmonlar javoblari / ответы гостей';

-- Row Level Security yoqilgan, lekin hech qanday public policy yo'q.
-- Yozuvlar faqat Edge Function orqali (service_role kaliti bilan) qo'shiladi,
-- u RLS ni chetlab o'tadi. Shu tariqa jadval hech kimga ochiq emas.
alter table public.rsvps enable row level security;

create index if not exists rsvps_created_at_idx on public.rsvps (created_at desc);
-- Rate-limit tekshiruvi tez ishlashi uchun (ip_hash bo'yicha oxirgi yozuvlar):
create index if not exists rsvps_ip_recent_idx on public.rsvps (ip_hash, created_at desc);
create index if not exists rsvps_phone_recent_idx on public.rsvps (phone, created_at desc);
