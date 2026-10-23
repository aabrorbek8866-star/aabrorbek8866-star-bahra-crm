# To'lov cheki (ma'lumotnoma) shablonini yasash: public/templates/chek_shablon.docx
# Manba: kompaniyaning chek Word fayli (qizil — o'zgaruvchan joylar), avval merge_runs.py bilan runlari birlashtirilgan.
#   python build_template.py m_chek.docx ../../public/templates/chek_shablon.docx
# Varaqda bir xil ikki nusxa (7–9 va 24–26-paragraflar) — ikkalasi ham to'ldiriladi.
import sys, docx
from docx.text.paragraph import Paragraph

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
src, out = sys.argv[1], sys.argv[2]
d = docx.Document(src)
paras = [Paragraph(p, d) for p in d.element.body.iter(W + 'p')]

def edit(pi, edits):
    runs = paras[pi].runs
    for ri, text in edits.items():
        runs[ri].text = text
        runs[ri].font.color.rgb = None  # chop etilganda qora

for title, date, body in ((7, 8, 9), (24, 25, 26)):
    edit(title, {1: "№{chekRaqam}"})
    edit(date, {0: "{sana} "})
    edit(body, {1: " {qavat}", 3: "{xonadon}", 5: "№{shartnomaRaqami} ", 13: "{fio} ", 14: " {summa} ", 15: " ({summaSoz}", 16: ")"})

# Asl matndagi aniq imlo xatolari: "жамиятитомонидан", "Bahra Building”" (ochuvchi qo'shtirnoq yo'q)
for pi in (9, 26):
    for r in paras[pi].runs:
        if "жамиятитомонидан" in r.text or "қурилаётган Bahra Building”" in r.text:
            r.text = r.text.replace("жамиятитомонидан", "жамияти томонидан").replace("қурилаётган Bahra Building”", "қурилаётган “Bahra Building”")

left = [(i, r.text) for i, p in enumerate(paras) for r in p.runs
        if r.font.color is not None and r.font.color.type is not None and str(r.font.color.rgb) == "FF0000" and r.text.strip()]
print("qolgan qizil:", left)
d.save(out)
print("saqlandi:", out)
