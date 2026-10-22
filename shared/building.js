// Frontend va backend uchun umumiy: bino tuzilmasi va SMS shabloni.

export const BUILDING = { entrances: 2, floors: 7, perFloor: 4, total: 56 };

/** Xonadon raqamidan podyezd va qavatni aniqlash: 1-podyezd 1..28, 2-podyezd 29..56, har qavatda 4 ta. */
export function locateApartment(number) {
  const perEntrance = BUILDING.floors * BUILDING.perFloor;
  const entrance = number <= perEntrance ? 1 : 2;
  const idx = (number - 1) % perEntrance;
  return { entrance, floor: Math.floor(idx / BUILDING.perFloor) + 1 };
}

const groupDigits = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** SMS shablonini to'ldirish. Server ham, frontend (namuna ko'rsatish) ham shu funksiyadan foydalanadi. */
export function fillSmsTemplate(tpl, c) {
  return tpl
    .replaceAll("{fio}", c.fullName.split(" ").slice(0, 2).join(" "))
    .replaceAll("{xonadon}", String(c.apartmentId))
    .replaceAll("{qarz}", groupDigits(c.debt))
    .replaceAll("{kun}", String(c.overdueDays))
    .replaceAll("{shartnoma}", c.contractNumber);
}
