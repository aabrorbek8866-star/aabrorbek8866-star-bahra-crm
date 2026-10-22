# Bahra Building CRM

Ko'p qavatli uy (7 qavat · 2 podyezd · 56 xonadon) sotuvi va mijozlar to'lovlarini nazorat qilish tizimi.
React 18 + Tailwind CSS + Recharts frontend, Node/Express + PostgreSQL backend.

**Serverga joylash:** [DEPLOY.md](DEPLOY.md) — Render + Neon, bepul.

## Lokal ishga tushirish

```bash
npm install
cp .env.example .env      # DATABASE_URL ni lokal PostgreSQL'ga moslang
npm run db:demo           # (ixtiyoriy) demo ma'lumotlar: 42 mijoz, ~900 to'lov
npm run dev               # web: http://localhost:5173 · api: http://localhost:4000
```
Dev rejimida birinchi ishga tushishda `admin` / `admin12345` hisobi yaratiladi.

## Imkoniyatlar

- **Login va rollar** — rahbar, menejer, kassir; har bir xodimga alohida hisob
- **Dashboard** — haftalik/oylik/yillik tushumlar, to'lov turlari, sotuv tempi
- **Xonadonlar shaxmatkasi** — 2 podyezd × 7 qavat, qarzdorlar qizil rangda
- **Mijoz kabineti** — ma'lumotlar, to'lov grafigi, PDF shartnoma (bazada saqlanadi)
- **To'lovlar** — Humo, Uzcard, bank, naqd; har birida majburiy **Izoh** va kim kiritgani
- **Qarzdorlar** — muddati o'tganlar, Eskiz.uz orqali SMS
- **Excel import/eksport** — takroriy import to'lovlarni ikki marta yozmaydi
- **AI agentlar** — CEO, Moliyachi, Yurist (Claude API)
- **Amallar jurnali** — kim, qachon, qaysi to'lovni qo'shdi/o'zgartirdi/o'chirdi
- **Kunlik zaxira** — GitHub Actions orqali `pg_dump`

## Fayl arxitekturasi

```
bahra-crm/
├── server/
│   ├── index.js                 # Express: API + tayyor frontendni berish
│   ├── config.js                # .env sozlamalari va tekshiruvi
│   ├── db/
│   │   ├── migrations/*.sql     # Jadval sxemasi (avtomatik qo'llanadi)
│   │   ├── pool.js · migrate.js # Ulanish, migratsiyalar
│   │   ├── bootstrap.js         # 56 xonadon + birinchi administrator
│   │   └── demo.js              # npm run db:demo
│   ├── auth/                    # JWT cookie sessiya, rollar va huquqlar
│   ├── routes/                  # auth, users, data, payments, clients (PDF), import, sms, ai, audit
│   ├── agents/prompts.js        # 3 ta AI agentning tizim promptlari
│   └── lib/                     # audit jurnali, mapperlar
├── shared/                      # Frontend va backend uchun umumiy: qarz hisobi, bino, SMS shabloni
├── src/
│   ├── store/                   # AuthContext (login), CrmContext (server bilan holat)
│   ├── services/                # api.js, aiContext.js
│   ├── pages/                   # Dashboard, Xonadonlar, Mijozlar, Profil, Qarzdorlar, Import, Xodimlar, Jurnal, Login
│   ├── components/              # layout, ui, dashboard, payments, clients, import, ai
│   └── utils/                   # excel, analytics, format
├── render.yaml                  # Render Blueprint
├── .github/workflows/backup.yml # Kunlik zaxira nusxa
└── DEPLOY.md                    # Joylash yo'riqnomasi
```

## Qarzdorlik qanday hisoblanadi

Har bir mijoz uchun shartnoma grafigi tuziladi: boshlang'ich to'lov (shartnoma sanasida) + har oy
`oylik to'lov`. Bugungacha to'lanishi kerak bo'lgan jami summa haqiqiy to'lovlardan ko'p bo'lsa,
farq — **muddati o'tgan qarz**, kechikish esa birinchi yopilmagan to'lov sanasidan hisoblanadi.
