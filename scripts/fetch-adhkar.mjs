// يجلب كل أبواب «حصن المسلم» ويحفظها في adhkar.json حتى تعمل الأذكار بدون إنترنت
import fs from 'node:fs';
const get = async (url, tries = 4) => {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (e) {}
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  throw new Error('failed ' + url);
};
const idx = await get('https://www.hisnmuslim.com/api/ar/husn_ar.json');
const out = [];
for (const c of idx['العربية']) {
  const j = await get(String(c.TEXT).replace('http:', 'https:'));
  const k = Object.keys(j)[0];
  out.push({ id: c.ID, t: c.TITLE, items: (j[k] || []).map((x) => ({ id: x.ID, x: String(x.ARABIC_TEXT || '').trim(), r: +x.REPEAT || 1 })) });
}
out.sort((a, b) => a.id - b.id);
if (out.length < 100) throw new Error('too few chapters: ' + out.length);
fs.writeFileSync('adhkar.json', JSON.stringify(out));
console.log('chapters', out.length, 'adhkar', out.reduce((s, c) => s + c.items.length, 0));
