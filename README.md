# Akmal Farm — Digital Invitation & RSVP

A polished, mobile-first **bilingual (Uzbek / Russian) event-invitation site** for the grand
opening of an Akmal Farm pharmacy branch, with a built-in **RSVP flow that delivers every
response to an admin on Telegram** and stores it in Supabase.

Guests tap **"I'll come" / "Can't make it"**, leave their name & phone, and the reply lands
instantly in the organizer's Telegram — no spreadsheet, no manual chasing.

**Tech stack:** static HTML/CSS/JS · Three.js (3D pill) · Motion (animations) ·
Vercel Serverless Function (`/api/rsvp`) · Supabase (Postgres + RLS) · Telegram Bot API.

**Highlights**
- 🎨 Editorial "medical-luxury" design — navy + Akmal-red, 3D capsule, animated ECG heartbeat line.
- ✍️ Iconographed RSVP form with a yes/no toggle, focus rings, and an animated success state.
- 🛠️ **Admin panel (`/admin`)** — edit every event text (title, date, address, map link, footer)
  from a dashboard; changes appear on the live site instantly, no redeploy.
- 📊 **RSVP report** — coming/not-coming counts and guest totals, grouped by location, with
  one-click **Excel/CSV export** (UTF-8 BOM so Cyrillic opens correctly).
- 🔒 Zero secrets in the browser — the frontend posts to same-origin serverless functions only.
- 🔐 **Admin auth:** scrypt-hashed password, HMAC-signed HttpOnly/Secure/SameSite cookie session,
  IP-based brute-force lockout, generic error messages (no user enumeration).
- 🛡️ **4-layer RSVP anti-spam:** honeypot, time-trap, per-IP rate-limit (hashed IPs), phone dedup.
- ♿ Accessible: labeled inputs, keyboard focus states, `prefers-reduced-motion` respected.

> Реализация ниже описана по-русски. / Setup guide below is in Russian.

---

## О проекте

Профессиональное двуязычное (UZ/RU) приглашение на открытие нового филиала
**Akmal Farm** с формой ответа (RSVP). Гость отвечает «приду / не смогу»,
заявка сохраняется в **Supabase** и мгновенно приходит **админу в Telegram**.

- **Дизайн** — статичный `index.html` (3D-капсула, ЭКГ-линия, анимации). Собирать не нужно.
- **Форма RSVP** — секция «JAVOB BERISH · ОТВЕТИТЬ» внизу страницы.
- **Админ-панель** — `/admin`, редактирует текст события без правки кода (см. ниже).
- **Бэкенд** — Vercel serverless-функции (без Supabase CLI и Docker).
- **База** — Supabase (`rsvps`, `site_content`, `admin_login_attempts`).
- **Уведомления** — Telegram-боту приходит каждая заявка.

```
index.html                        ← сайт + форма (генерируется, см. ниже)
app.js                            ← клиентский JS сайта (RSVP, таймер, гидратация контента)
admin/
  index.html  admin.css  admin.js ← панель управления контентом
api/
  rsvp.js                         ← RSVP: пишет в Supabase + шлёт в Telegram
  content.js                      ← PUBLIC GET: joriy kontent (sayt shu yerdan oladi)
  admin/
    login.js  logout.js  session.js  content.js  ← auth + CMS (GET/PUT)
  _lib/
    auth.js  supabase.js  rateLimit.js  contentSchema.js  ← umumiy yordamchilar
vercel.json                       ← настройки хостинга
.env.example                      ← какие переменные задать в Vercel
supabase/
  migrations/0001_rsvps.sql       ← таблица rsvps
  migrations/0002_site_content.sql← таблица site_content + admin_login_attempts
```

> Ключи (service_role, токен бота) хранятся **только** как переменные окружения на Vercel —
> в браузер они не попадают. Фронтенд просто отправляет форму на `/api/rsvp` того же домена.

---

## Запуск — 4 шага (файлы редактировать НЕ нужно)

### 1. Supabase — только база
1. https://supabase.com → **New project** (регион EU/Frankfurt). Запомнить пароль.
2. **SQL Editor** → New query → по очереди вставить и запустить:
   - [`supabase/migrations/0001_rsvps.sql`](supabase/migrations/0001_rsvps.sql) → таблица `rsvps`.
   - [`supabase/migrations/0002_site_content.sql`](supabase/migrations/0002_site_content.sql) → таблица `site_content` (контент админ-панели) + `admin_login_attempts` (защита от подбора пароля).
   - [`supabase/migrations/0003_rsvp_location.sql`](supabase/migrations/0003_rsvp_location.sql) → колонка `location` в `rsvps` (для отчёта по локациям).
3. **Settings → API** → скопировать два значения:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** (secret) → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ секрет, не публикуй.

### 2. Telegram-бот
1. @BotFather → `/newbot` → получить **token** → это `TELEGRAM_BOT_TOKEN`.
2. Узнать свой **chat_id**: напишите боту **@userinfobot** — он пришлёт ваш `id` → это `TELEGRAM_ADMIN_CHAT_ID`.
   > Для отправки в чат/канал — добавьте бота туда админом и укажите id этого чата.

### 3. Задеплоить на Vercel
- Залить папку в GitHub → на https://vercel.com **Add New → Project → Import**, framework **Other** (сборки нет).
- Открыть **Settings → Environment Variables** и добавить (значения из `.env.example`):

| Name | Value |
|------|-------|
| `SUPABASE_URL` | из шага 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | из шага 1 (secret) |
| `TELEGRAM_BOT_TOKEN` | из шага 2 (secret) |
| `TELEGRAM_ADMIN_CHAT_ID` | ваш chat_id из шага 2 |
| `IP_SALT` | любая случайная строка (необязательно) |
| `ADMIN_USERNAME` | `WHITE` |
| `ADMIN_PASSWORD_HASH` | scrypt-хэш пароля, см. раздел «Админ-панель» ниже |
| `ADMIN_SESSION_SECRET` | случайная строка 32+ байт, см. раздел «Админ-панель» ниже |

- Нажать **Deploy** (или Redeploy, если переменные добавили после первого деплоя).
- Через CLI как альтернатива: `npm i -g vercel` → `vercel` → задать env → `vercel --prod`.

### 4. Проверка
Открыть сайт → «Ha, kelaman» → имя/телефон → **Yuborish**. Должно:
(а) показать «Rahmat! Sizni kutamiz», (б) прислать сообщение вам в Telegram,
(в) добавить строку в таблицу `rsvps` (Supabase → Table Editor).

---

## Где смотреть ответы
- **Telegram** — каждая заявка приходит вам сообщением (✅ придёт / ❌ не придёт, имя, телефон, гости, комментарий).
- **Supabase → Table Editor → `rsvps`** — полный список (можно выгрузить в CSV).

## Данные события — редактируются через `/admin`, без кода
Заголовок, описание, дата/время, адрес, ссылка на карту, подпись и контакты —
всё меняется в панели управления (см. ниже). При первом деплое действуют
значения по умолчанию из `supabase/migrations/0002_site_content.sql`
(2 июля 2026, 11:00, Кургантепа) — их можно сразу поменять из `/admin`.

---

## Админ-панель (`/admin`)

Отдельная страница `https://ваш-домен/admin` — вход по логину/паролю, дальше
форма со всеми текстами сайта (двуязычно UZ/RU), таймер до события, ссылка
на карту. Нажал **Сохранить** — изменения сразу видны на сайте (без деплоя,
без правки файлов).

### Отчёт по RSVP

Вверху панели — блок **«Javoblar hisoboti / Отчёт»**:
- сводка: сколько всего ответов, сколько **придёт** (людей и ответов), сколько **не придёт**;
- разбивка **по локациям** (каждый ответ помечается текущей «локацией» из поля
  `event.location_name` — меняй его при каждом новом открытии филиала, тогда отчёт
  сгруппируется по филиалам, а старые ответы сохранят свою локацию);
- таблица всех ответов (имя, телефон, статус, гости, дата);
- три кнопки экспорта:
  - **Excel** — настоящий `.xlsx` (кириллица не ломается ни в одной версии Excel, телефоны как текст, а не `9,99E+11`);
  - **Word** — `.doc` с оформленной таблицей;
  - **PNG** — картинка-сводка (шапка + карточки + разбивка по локациям) для быстрой отправки, например в Telegram.
  (`.xlsx`/`.doc` генерируются на сервере без внешних библиотек; PNG рисуется в браузере на canvas.)

### Настройка логина (один раз)

**Пароль в открытом виде нигде не хранится** — только scrypt-хэш в переменной
окружения. Сгенерировать его локально в папке проекта:

```bash
node -e "const a=require('./api/_lib/auth.js');console.log(a.hashPassword('ВАШ_ПАРОЛЬ'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Первая команда даёт значение для `ADMIN_PASSWORD_HASH`, вторая — случайную
строку для `ADMIN_SESSION_SECRET` (ею подписываются сессии — держите в секрете
и не переиспользуйте из других проектов). Вписать вместе с `ADMIN_USERNAME`
в Environment Variables на Vercel (таблица выше) и передеплоить.

### Как это защищено
- Пароль сравнивается через **scrypt** (дорогой по вычислениям хэш, не MD5/SHA1) с таймингобезопасным сравнением.
- Сессия — HMAC-подписанный токен в cookie с флагами **HttpOnly** (не читается из JS/XSS),
  **Secure** (только HTTPS), **SameSite=Strict** (не отправляется с других сайтов → CSRF не нужен отдельный токен). Живёт 12 часов.
- **Rate-limit**: после 8 неудачных попыток с одного IP за 15 минут — блокировка (таблица `admin_login_attempts`).
- Ошибка входа всегда одна и та же фраза — не разглашает, логин или пароль неверны.
- Все сохранённые тексты вставляются на сайте через `textContent` (никогда `innerHTML`) —
  даже если что-то странное попадёт в базу, оно не выполнится как HTML/скрипт.
- `/admin` не индексируется (`robots: noindex`), но URL публичный — доступ защищён паролем, не секретностью адреса.

> ⚠️ Если исходный пароль короткий — для внутреннего одноразового инструмента это
> приемлемо благодаря rate-limit + scrypt, но при желании его легко усилить —
> просто сгенерируйте новый хэш командой выше и обновите `ADMIN_PASSWORD_HASH`.
> (Сам пароль нигде в репозитории/README не хранится — только его хэш в Vercel.)

## Локальный тест дизайна
`index.html` открывается сам по себе в браузере (формы отправляют на `/api/*`, которые
работают только на Vercel). Для полного локального теста удобнее `vercel dev`.

## Безопасность и анти-спам
- Все секреты (service_role, токен бота, ADMIN_PASSWORD_HASH, ADMIN_SESSION_SECRET) —
  **только** env-переменные на Vercel, в браузер не попадают.
- Таблицы `rsvps` / `site_content` / `admin_login_attempts` закрыты RLS; запись идёт
  только с сервера (service_role).
- **Анти-спам RSVP** (4 уровня, настраивать не нужно):
  1. **Honeypot** — скрытое поле `company`; боты его заполняют → тихо отклоняется.
  2. **Ловушка по времени** — заявка быстрее 2.5 сек после загрузки → бот.
  3. **Rate-limit по IP** — максимум 5 заявок с IP за 10 минут (IP хранится как SHA-256 хэш).
  4. **Дедуп по телефону** — один номер не отправит повтор в течение 45 сек.
- Пороги — вверху [`api/rsvp.js`](api/rsvp.js) (`IP_MAX_IN_WINDOW`, `MIN_FILL_MS` и т.д.).
