import { COMPANY } from "../../../shared/company.js";

// Chop etish uchun chek — kompaniyaning Word shabloni (public/templates/chek_shablon.docx) ko'rinishida.
// A4 varaqda ikki nusxa: biri mijozga, biri kompaniyaga (o'rtada qirqish chizig'i).

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function copy(d, logoUrl) {
  return `
  <section class="copy">
    <header>
      <div class="side left">
        <div class="country">Республика Узбекистан</div>
        <div>Навоийская областъ</div>
        <div>Город Навои</div>
        <div class="org">ООО “ПРОПАН БЕСТ”</div>
      </div>
      <img class="logo" src="${esc(logoUrl)}" alt="${esc(COMPANY.brand)}">
      <div class="side right">
        <div class="country">O‘ZBEKISTON RESPUBLIKASI</div>
        <div>NAVOIY VILOYATI</div>
        <div>NAVOIY SHAHAR</div>
        <div class="org">“PROPAN BEST” MCHJ</div>
      </div>
    </header>
    <div class="rule"></div>
    <p class="requisites">р/с 20208000400404857001 в Халқ Банк г.Зарафшон МФО 01125 ИНН.${esc(COMPANY.inn)} тел(99-667-02-20)</p>
    <h1>МАЪЛУМОТНОМА №${esc(d.chekRaqam)}</h1>
    <div class="row"><span><b>${esc(d.sana)}</b> йил</span><span>Зарафшон шаҳри</span></div>
    <p class="body">
      Берилди ушбу маълумотнома шу ҳақдаким, “PROPAN BEST” масъулияти чекланган жамияти томонидан қурилаётган
      “Bahra Building” уй-жой мажмуаси, “С” Блок уйнинг <b>${esc(d.qavat)}</b>-Этаждаги <b>${esc(d.xonadon)}</b>-хонадон учун
      тузилган хонадон қурилишига буюртма бериш тўғрисидаги <b>№${esc(d.shartnomaRaqami)}</b> сонли шартномага асосан
      буюртмачи <b>${esc(d.fio)}</b> <b class="sum">${esc(d.summa)} (${esc(d.summaSoz)})</b> сўм пул маблағи
      жамият ҳисобга график асосида қабул қилинди.
    </p>
    <div class="row sign"><span>“PROPAN BEST” МЧЖ директори:</span><span class="line"></span><span>Ш. Шарипов</span></div>
  </section>`;
}

/** @param {ReturnType<import("../../../shared/notary.js").receiptTemplateData>} data */
export function receiptHtml(data, logoUrl) {
  return `<!doctype html>
<html lang="uz"><head><meta charset="utf-8"><title>Chek №${esc(data.chekRaqam)}</title>
<style>
  @page { size: A4; margin: 10mm 15mm 10mm 17.5mm; }
  * { box-sizing: border-box; }
  html { background: #e2e8f0; }
  body { margin: 0; font: 10pt/1.45 Calibri, Carlito, "Segoe UI", Arial, sans-serif; color: #000; }
  /* Ekranda oynaga sig'dirish (--fit ota oynadan beriladi), printerda asl o'lcham */
  @media screen { .sheet { zoom: var(--fit, 1); } }
  .sheet { width: 210mm; min-height: 297mm; margin: 12px auto; padding: 10mm 15mm 10mm 17.5mm; background: #fff;
           box-shadow: 0 2px 12px rgba(0,0,0,.15); display: flex; flex-direction: column; }
  .copy { height: 132mm; display: flex; flex-direction: column; }
  .cut { border-top: 1px dashed #94a3b8; margin: 4mm 0 6mm; position: relative; }
  .cut::after { content: "✂"; position: absolute; left: -6mm; top: -2.4mm; font-size: 9pt; color: #94a3b8; }
  header { display: grid; grid-template-columns: 1fr 38mm 1fr; align-items: center; gap: 4mm; }
  .side { font-family: Cambria, Caladea, Georgia, serif; font-weight: 700; font-size: 10pt; line-height: 1.5; }
  .side.right { text-align: right; }
  .country { color: #2e74b5; font-size: 11pt; }
  .org { margin-top: 3mm; }
  .logo { width: 38mm; height: 38mm; object-fit: contain; justify-self: center; }
  .rule { border-top: 1.5px solid #000; margin: 2mm 0 1.5mm; }
  .requisites { text-align: center; font-style: italic; text-decoration: underline; font-size: 8pt; margin: 0 0 4mm; }
  h1 { text-align: center; font-size: 10pt; font-weight: 400; margin: 0 0 3mm; letter-spacing: .3pt; }
  .row { display: flex; justify-content: space-between; align-items: baseline; }
  .body { text-align: justify; text-indent: 12mm; margin: 4mm 0 0; }
  .sum { white-space: nowrap; }
  .sign { margin-top: auto; padding-bottom: 2mm; gap: 4mm; font-weight: 700; }
  .sign .line { flex: 1; border-bottom: 1px solid #000; margin: 0 4mm 1mm; }
  @media print {
    html { background: #fff; }
    .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
    .cut::after { content: ""; }
  }
</style></head>
<body><div class="sheet">${copy(data, logoUrl)}<div class="cut"></div>${copy(data, logoUrl)}</div></body></html>`;
}
