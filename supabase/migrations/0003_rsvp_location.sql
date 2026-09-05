-- Akmal Farm — Taklifnoma :: RSVP javoblariga "location" ustuni qo'shamiz.
-- Har bir javob yuborilganda o'sha paytdagi tadbir lokatsiyasi (admin
-- paneldagi "location_name") shu ustunga saqlanadi — shunda hisobotni
-- lokatsiyalar bo'yicha guruhlash mumkin, hatto keyin tadbir o'zgarsa ham
-- eski javoblar o'z lokatsiyasini saqlaydi.

alter table public.rsvps add column if not exists location text;
create index if not exists rsvps_location_idx on public.rsvps (location);
