// Bazadagi snake_case qatorlarni frontend kutayotgan camelCase ob'ektlarga aylantirish.

export const CLIENT_COLUMNS = `id, apartment_id, full_name, passport, phone, contract_number, contract_date,
  last_payment_date, total_price, down_payment, monthly_payment, installment_months,
  contract_pdf_name, contract_pdf_at, (contract_pdf IS NOT NULL) AS has_contract,
  full_name_cyr, jshshir, address, passport_issued_by, passport_issued_at, notarized, notarized_at,
  notary_pdf_name, notary_pdf_at, (notary_pdf IS NOT NULL) AS has_notary_pdf`;

export const toClient = (r) => ({
  id: r.id,
  apartmentId: r.apartment_id,
  fullName: r.full_name,
  passport: r.passport,
  phone: r.phone,
  contractNumber: r.contract_number,
  contractDate: r.contract_date,
  lastPaymentDate: r.last_payment_date,
  totalPrice: r.total_price,
  downPayment: r.down_payment,
  monthlyPayment: r.monthly_payment,
  installmentMonths: r.installment_months,
  contractPdfName: r.contract_pdf_name,
  // URL'ga yuklangan vaqt qo'shiladi — yangi versiya yuklanganda brauzer keshi eskisini ko'rsatmasin
  contractPdfUrl: r.has_contract ? `/api/clients/${r.id}/contract?v=${new Date(r.contract_pdf_at).getTime()}` : null,
  fullNameCyr: r.full_name_cyr,
  jshshir: r.jshshir,
  address: r.address,
  passportIssuedBy: r.passport_issued_by,
  passportIssuedAt: r.passport_issued_at,
  notarized: r.notarized,
  notarizedAt: r.notarized_at,
  notaryPdfName: r.notary_pdf_name,
  notaryPdfUrl: r.has_notary_pdf ? `/api/clients/${r.id}/notary?v=${new Date(r.notary_pdf_at).getTime()}` : null,
});

export const PAYMENT_COLUMNS = `p.id, p.client_id, p.date, p.type, p.amount, p.comment, p.created_at, p.updated_at,
  cu.full_name AS created_by_name, uu.full_name AS updated_by_name`;

export const PAYMENT_JOINS = `LEFT JOIN users cu ON cu.id = p.created_by LEFT JOIN users uu ON uu.id = p.updated_by`;

export const toPayment = (r) => ({
  id: r.id,
  clientId: r.client_id,
  date: r.date,
  type: r.type,
  amount: r.amount,
  comment: r.comment,
  createdAt: r.created_at,
  createdBy: r.created_by_name,
  updatedAt: r.updated_at,
  updatedBy: r.updated_by_name,
});

export const toApartment = (r) => ({
  id: r.id,
  entrance: r.entrance,
  floor: r.floor,
  area: r.area,
  rooms: r.rooms,
  totalArea: r.total_area,
  livingArea: r.living_area,
  status: r.status,
  clientId: r.client_id ?? null,
});
