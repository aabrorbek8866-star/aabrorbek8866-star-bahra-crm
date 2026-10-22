# Arxitektura

## Ma'lumotlar oqimi

```
Brauzer (React)                         Server (Express)                    PostgreSQL (Neon)
───────────────                         ────────────────                    ─────────────────
Login ───────────── POST /api/auth/login ──► bcrypt tekshiruv ──────────────► users
                    ◄── httpOnly cookie (JWT, 12 soat)
CrmContext ──────── GET /api/data ─────────► requireAuth ───────────────────► apartments, clients,
  └ calcClientDebt() (shared/debt.js)                                           payments, sms_log
PaymentForm ─────── POST/PATCH/DELETE ─────► huquq tekshiruvi ──► payments + audit_log
  /api/payments
ExcelImport ─────── POST /api/import ──────► qayta validatsiya ──► bitta tranzaksiya
ContractUpload ──── POST /api/clients/:id/contract ──────────────► clients.contract_pdf (BYTEA)
Debtors ─────────── POST /api/sms/send ────► telefon va qarz bazadan ──► Eskiz.uz ──► sms_log
AgentChat ───────── POST /api/ai/chat ─────► agent prompti + CRM surati ──► Claude API (stream)
```

## Rollar

| Huquq | Kassir | Menejer | Rahbar |
|---|:-:|:-:|:-:|
| Ko'rish, to'lov qo'shish | ✓ | ✓ | ✓ |
| To'lovni tahrirlash, PDF yuklash, SMS, AI | | ✓ | ✓ |
| To'lovni o'chirish, Excel import, xodimlar, jurnal | | | ✓ |

Huquqlar serverda tekshiriladi (`server/auth/permissions.js`); frontend faqat keraksiz tugmalarni yashiradi.

## Jadvallar

Sxema: `server/db/migrations/001_init.sql`. Yangi o'zgarish uchun `002_....sql` fayl qo'shiladi —
server ishga tushganda faqat hali bajarilmagan migratsiyalarni qo'llaydi.

## Xavfsizlik

- Parollar bcrypt bilan, sessiya httpOnly + Secure cookie'da; login urinishlari cheklangan (15 daqiqada 10 ta).
- O'chirilgan xodim keyingi so'rovdayoq tizimdan chiqadi (har so'rovda bazadan tekshiriladi).
- Izohsiz yoki manfiy summali to'lov baza darajasida ham rad etiladi (CHECK cheklovlari).
- To'lovlarning har bir o'zgarishi eski va yangi qiymati bilan `audit_log` ga yoziladi.
- AI va SMS kalitlari faqat serverda; AI kontekstiga pasport ma'lumotlari kiritilmaydi.
- PDF fayllar bazada — server qayta o'rnatilsa yo'qolmaydi va kunlik zaxiraga kiradi.
