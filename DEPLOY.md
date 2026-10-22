# Bepul joylash: Render + Neon

Natija: `https://bahra-crm.onrender.com` kabi manzil, ma'lumotlar PostgreSQL bazasida doimiy saqlanadi,
har kuni avtomatik zaxira nusxa olinadi. Hammasi bepul, bank kartasi talab qilinmaydi.

| Qism | Xizmat | Bepul tarif |
|---|---|---|
| Sayt + server | [Render](https://render.com) | Web service, `*.onrender.com` manzil, HTTPS |
| Ma'lumotlar bazasi | [Neon](https://neon.com) | PostgreSQL, 0.5 GB, oyiga 100 CU-soat |
| Kod va zaxira | [GitHub](https://github.com) | Private repozitoriy, Actions |

## Bilish kerak bo'lgan cheklovlar

- **Birinchi ochilish sekin.** Render bepul serveri ~15 daqiqa ishlatilmasa "uxlaydi". Keyingi ochilishda
  sayt 30–60 soniyada uyg'onadi, keyin odatdagidek tez ishlaydi. Xohlasangiz, [UptimeRobot](https://uptimerobot.com)
  (bepul) da `https://<sayt>/api/health` manzilini har 5 daqiqada tekshiradigan monitor qo'shing — server uxlamaydi.
  Bu manzil bazaga murojaat qilmaydi, shuning uchun Neon limitini sarflamaydi.
- **Baza hajmi 0.5 GB.** 56 ta mijoz va minglab to'lovlar uchun bir necha MB yetadi. Ko'p joyni faqat PDF
  shartnomalar oladi (har biri 10 MB gacha) — skanerlarni o'rtacha sifatda (1–3 MB) saqlang.
- **Domen.** Bepul manzil `....onrender.com`. `bahrabuilding.uz` kabi o'z domeningiz pullik (registratorda
  yillik to'lov); sotib olgach Render → Settings → Custom Domains orqali ulanadi, kodni o'zgartirish shart emas.

---

## 1-qadam. GitHub (kodni saqlash)

1. https://github.com da ro'yxatdan o'ting.
2. **New repository** → nom: `bahra-crm` → **Private** ni tanlang (muhim!) → Create.
3. Kod shu repozitoriyga yuklanadi (buni Claude bajaradi yoki `git push`).

## 2-qadam. Neon (ma'lumotlar bazasi)

1. https://neon.com → **Sign up** (GitHub hisobi bilan kirish mumkin).
2. **Create project**: nom `bahra-crm`, Postgres 16, region **AWS Europe Central 1 (Frankfurt)**.
3. **Connect** tugmasi → "Connection string" ni nusxalang. Ko'rinishi:
   `postgresql://neondb_owner:xxxx@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`
   Bu — `DATABASE_URL`. Uni hech kimga yubormang.

## 3-qadam. Render (sayt)

1. https://render.com → **Sign up with GitHub**.
2. **New → Blueprint** → `bahra-crm` repozitoriyini tanlang. Render `render.yaml` ni o'qib, sozlamalarni o'zi to'ldiradi.
3. So'raladigan qiymatlarni kiriting:
   - `DATABASE_URL` — Neon'dan nusxalangan qator
   - `ADMIN_PASSWORD` — rahbar uchun kuchli parol (kamida 8 belgi, yaxshisi 12+)
   - `ANTHROPIC_API_KEY` — AI agentlar uchun (https://console.anthropic.com → API Keys). Hozircha bo'sh qoldirish mumkin.
   - `ESKIZ_EMAIL`, `ESKIZ_PASSWORD` — SMS uchun (https://eskiz.uz). Bo'sh bo'lsa SMS yuborilmaydi, faqat jurnalga yoziladi.
4. **Apply**. Birinchi build 3–5 daqiqa davom etadi. Tayyor bo'lgach yuqorida manzil chiqadi:
   `https://bahra-crm.onrender.com` (nom band bo'lsa, oxiriga qo'shimcha harflar qo'shiladi).

Birinchi ishga tushishda server o'zi jadvallarni va 56 ta xonadonni yaratadi.

## 4-qadam. Birinchi kirish

1. Saytni oching → login `admin`, parol — `ADMIN_PASSWORD` da yozganingiz.
2. **Excel import** → shablonni yuklab oling, ma'lumotlarni to'ldirib, qayta yuklang → **Import qilish**.
3. **Xodimlar** → har bir xodimga alohida login yarating:
   - *Kassir* — to'lov qo'shadi, mijozlarni ko'radi
   - *Menejer* — + to'lovni tahrirlash, PDF, SMS, AI agentlar
   - *Rahbar* — hamma narsa, shu jumladan import, to'lovni o'chirish, amallar jurnali
4. Har bir to'lov kim tomonidan kiritilgani/o'zgartirilgani **Amallar jurnali** da ko'rinadi.

## 5-qadam. Kunlik zaxira nusxa

1. GitHub → repozitoriy → **Settings → Secrets and variables → Actions → New repository secret**:
   nom `DATABASE_URL`, qiymat — Neon connection string.
2. **Actions** bo'limida "Bazani zaxiralash" → **Run workflow** — sinab ko'ring.
   Shundan keyin har kuni tunda avtomatik ishlaydi; fayllar 30 kun saqlanadi (Actions → run → Artifacts).

Zaxiradan tiklash (kompyuterda PostgreSQL klienti bo'lishi kerak):
```bash
pg_restore --clean --no-owner -d "$DATABASE_URL" bahra_crm_2026-10-22.dump
```

## Yangilanishlar

Kodga kiritilgan har bir o'zgarish GitHub'ga yuklanganda Render saytni avtomatik qayta quradi.
Bazadagi ma'lumotlar o'zgarmaydi; yangi jadval/ustunlar `server/db/migrations/` orqali o'zi qo'shiladi.

## Xavfsizlik bo'yicha eslatmalar

- Repozitoriy faqat **Private** bo'lsin.
- `DATABASE_URL`, parollar va API kalitlarini faqat Render/GitHub sozlamalarida saqlang, chatlarda yubormang.
- Ishdan ketgan xodimni **Xodimlar** bo'limida darhol "O'chirilgan" holatiga o'tkazing — u keyingi bosishdayoq tizimdan chiqadi.
