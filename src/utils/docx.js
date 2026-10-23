// Word shablonlarini brauzerda to'ldirish, yuklab olish va chop etish.
// Kutubxonalar faqat kerak bo'lganda yuklanadi (asosiy sahifa og'irlashmasin).

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** /templates/... dagi shablonni {o'zgaruvchi}lar bilan to'ldirib, Blob qaytaradi. */
export async function renderTemplate(url, data) {
  const [{ default: PizZip }, { default: Docxtemplater }, res] = await Promise.all([
    import("pizzip"),
    import("docxtemplater"),
    fetch(url),
  ]);
  if (!res.ok) throw new Error("Shablon fayli topilmadi");
  const doc = new Docxtemplater(new PizZip(await res.arrayBuffer()), { paragraphLoop: true, linebreaks: true, nullGetter: () => "" });
  doc.render(data);
  return doc.getZip().generate({ type: "blob", mimeType: DOCX_MIME });
}

/** Fayl nomi lotincha bo'lsin — ba'zi brauzerlar kirill harfli nomni "download" deb saqlaydi. */
export function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
