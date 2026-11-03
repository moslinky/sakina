/* =====================================================================
   سكينة — تطبيق ويب (PWA)
   ===================================================================== */
'use strict';

// ------------------------------------------------------------------ أدوات
function load(k, d) { try { const v = localStorage.getItem('sk.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function save(k, v) { try { localStorage.setItem('sk.' + k, JSON.stringify(v)); } catch (e) {} }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const AR = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const rnd = (n) => Math.floor(Math.random() * n);
const DAY = Math.floor(Date.now() / 86400000);
const $ = (id) => document.getElementById(id);
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const APP_URL = location.href.split('#')[0].split('?')[0];

function starPts(c, r, k = 0.8) {
  const p = [];
  for (let i = 0; i < 16; i++) {
    const rr = i % 2 ? r * k : r, a = (Math.PI / 8) * i - Math.PI / 2;
    p.push((c + rr * Math.cos(a)).toFixed(1) + ',' + (c + rr * Math.sin(a)).toFixed(1));
  }
  return p.join(' ');
}
const medal = (g, color) => `<span class="medal" style="color:${color || 'var(--deco)'}"><svg viewBox="0 0 52 52" aria-hidden="true"><polygon points="${starPts(26, 25)}" style="fill:var(--gold-soft);stroke:currentColor"/></svg><span>${g}</span></span>`;
const orn = (w) => `<svg class="orn" width="${w}" height="16" viewBox="0 0 ${w} 16" aria-hidden="true"><path d="M0 8H${w / 2 - 16}M${w / 2 + 16} 8H${w}" style="stroke:currentColor" opacity=".6"/><path d="M${w / 2} 1l7 7-7 7-7-7z" style="fill:none;stroke:currentColor"/><path d="M${w / 2} 4.5l3.5 3.5-3.5 3.5-3.5-3.5z" style="fill:currentColor"/></svg>`;

// ------------------------------------------------------------------ الحالة
const all = DATA.cats.flatMap((c) => c.items.map((i) => ({ ...i, cat: c })));
const SACRED = (t) => t === 'ayah' || t === 'hadith' || t === 'dhikr';
const ICON = { calm: '🤍', qadar: '۞', iman: '☪', miracles: '✧', peace: '❀', rida: '♡', prophets: '✺', salat: '۩', shukr: '✿', sadaqa: '❦' };
const st = {
  view: 'home', fav: load('fav', []), total: load('total', 0), done: load('done', []), dh: 0, count: 0,
  set: { interval: 60, enabled: true, adhan: true, quiet: true, qs: 23, qe: 7, cats: DATA.cats.map((c) => c.id), ...load('set', {}) },
  qmode: load('qmode', 'book'), qsize: load('qsize', 25), theme: load('theme', 'light'),
};
if (!st.set.cats.includes('calm') && !load('calmAdded', false)) { st.set.cats.unshift('calm'); save('calmAdded', true); }
const SNAP = ['view', 'cat', 'item', 'sura', 'ayah', 'page', 'libCat', 'libPage', 'filter', 'dkc', 'qtab'];
let stack = [];
function go(view, extra = {}) { closeSheet(); Object.assign(st, { view }, extra); render(); window.scrollTo(0, 0); }
function push(view, extra = {}) { const p = {}; SNAP.forEach((k) => (p[k] = st[k])); stack.push(p); go(view, extra); }
function back() { closeSheet(); const p = stack.pop() || { view: 'home' }; Object.assign(st, p); render(); }

function header(title, sub, opts = {}) {
  const left = opts.right || '<span class="hph"></span>';
  return `<header class="hdr wrap"><div class="row">${opts.back !== false && stack.length ? `<button class="hbtn" aria-label="رجوع" onclick="back()">›</button>` : '<span class="hph"></span>'}<h1>${esc(title)}</h1>${left}</div>${sub ? `<p>${esc(sub)}</p>` : ''}</header>`;
}

// ------------------------------------------------------------------ المظهر
function applyTheme() {
  let t = st.theme;
  if (t === 'auto') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.content = t === 'dark' ? '#1C6551' : '#157257';
}
function setTheme(t) { st.theme = t; save('theme', t); applyTheme(); render(); }
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => st.theme === 'auto' && applyTheme());

// ------------------------------------------------------------------ المحتوى المتجدد (من الإنترنت)
let DYN = load('dyn', {});
let FEED = load('feed', []);
const MEM = {};
const DYN_CAT = { hadith: 'أحاديث متجددة', ayah: 'آية وتفسير', dhikr: 'الأذكار', quran: 'القرآن الكريم' };
const H_ROOTS = [{ id: 3, t: 'العقيدة' }, { id: 5, t: 'الفضائل والآداب' }, { id: 1, t: 'القرآن الكريم وعلومه' }, { id: 4, t: 'الفقه وأصوله' }, { id: 7, t: 'السيرة والتاريخ' }, { id: 6, t: 'الدعوة والحسبة' }, { id: 2, t: 'الحديث وعلومه' }];

async function api(url) {
  if (MEM[url]) return MEM[url];
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  MEM[url] = j;
  return j;
}
function saveDyn() {
  FEED = FEED.slice(0, 200);
  const keys = Object.keys(DYN);
  if (keys.length > 500) {
    const keep = new Set([...FEED, ...st.fav]);
    let extra = keys.length - 400;
    for (const k of keys) { if (extra <= 0) break; if (!keep.has(k)) { delete DYN[k]; extra--; } }
  }
  save('dyn', DYN); save('feed', FEED);
}
function addDyn(item, toFeed) { DYN[item.id] = item; if (toFeed && !FEED.includes(item.id)) FEED.unshift(item.id); saveDyn(); return item; }
function getItem(id) {
  const s = all.find((x) => x.id === id);
  if (s) return s;
  const d = DYN[id];
  if (!d) return null;
  return { ...d, cat: { id: 'dyn', title: DYN_CAT[d.src] || 'سكينة', items: [] } };
}
function hadithItem(o) {
  let body = '';
  if (o.explanation) body += 'الشرح:\n' + o.explanation.trim();
  if (o.hints && o.hints.length) body += '\n\nمن فوائد الحديث:\n' + o.hints.map((h) => '• ' + h).join('\n');
  body += '\n\nالمصدر: موسوعة الأحاديث النبوية (HadeethEnc.com)';
  return { id: 'h-' + o.id, src: 'hadith', type: 'hadith', title: o.title.length > 70 ? o.title.slice(0, 68) + '…' : o.title, text: o.hadeeth.trim(), source: [o.attribution, o.grade].filter(Boolean).join(' — '), body };
}
async function loadHadith(id) {
  if (DYN['h-' + id]) return DYN['h-' + id];
  return addDyn(hadithItem(await api(`https://hadeethenc.com/api/v1/hadeeths/one/?language=ar&id=${id}`)), false);
}
async function randomHadith() {
  const meta = load('hmeta', {});
  const root = H_ROOTS[rnd(H_ROOTS.length)].id;
  let total = meta[root];
  if (!total) {
    const m = await api(`https://hadeethenc.com/api/v1/hadeeths/list/?language=ar&category_id=${root}&page=1&per_page=1`);
    total = +m.meta.total_items; meta[root] = total; save('hmeta', meta);
  }
  const l = await api(`https://hadeethenc.com/api/v1/hadeeths/list/?language=ar&category_id=${root}&page=${1 + rnd(total)}&per_page=1`);
  return addDyn(hadithItem(await api(`https://hadeethenc.com/api/v1/hadeeths/one/?language=ar&id=${l.data[0].id}`)), true);
}
async function loadAyahTafsir(ref) {
  const j = await api(`https://api.alquran.cloud/v1/ayah/${ref}/editions/quran-uthmani,ar.muyassar`);
  return { a: j.data[0], t: j.data[1] };
}
async function randomAyah() {
  const q = await qdata();
  const g = 1 + rnd(6236);
  const [s, a] = fromGlobal(g);
  const { t } = await loadAyahTafsir(s + ':' + a);
  return addDyn({ id: `q-${s}:${a}`, src: 'ayah', type: 'ayah', hafs: true, title: `سورة ${q.c[s - 1][0]} — الآية ${AR(a)}`, text: q.v[s - 1][a - 1], source: `سورة ${q.c[s - 1][0]} - الآية ${a}`, body: 'التفسير الميسر (مجمع الملك فهد):\n' + t.text }, true);
}
async function randomDhikr() {
  const A = await adhkarData();
  const c = A[rnd(A.length)];
  const x = c.items[rnd(c.items.length)];
  return addDyn(dhikrItem(c, x), true);
}
function dhikrItem(c, x) {
  return { id: `d-${x.id}`, src: 'dhikr', type: 'dhikr', title: c.t, text: x.x, source: 'حصن المسلم' + (x.r > 1 ? ` — يُكرَّر ${AR(x.r)} مرات` : ''), chap: c.id };
}
let refreshing = false;
async function refreshFeed(force) {
  if (refreshing || !navigator.onLine) return;
  if (!force && FEED.length >= 6 && Date.now() - load('lastFeed', 0) < 3 * 3600e3) return;
  refreshing = true;
  await Promise.allSettled([randomHadith, randomHadith, randomHadith, randomAyah, randomAyah, randomDhikr, randomDhikr].map((f) => f()));
  save('lastFeed', Date.now());
  refreshing = false;
  if (st.view === 'home' || st.view === 'feed') render();
}
function need(key, fn) {
  if (MEM['v:' + key] !== undefined) return MEM['v:' + key];
  MEM['v:' + key] = null;
  fn().then((v) => { MEM['v:' + key] = v; render(); }).catch(() => { MEM['v:' + key] = 'ERR'; render(); });
  return null;
}
function retryKey(key) { delete MEM['v:' + key]; render(); }
const loading = (m) => `<div class="card center muted">${m || 'جارٍ التحميل…'}</div>`;
const errBox = (retry) => `<div class="card center muted">تعذّر التحميل. تأكد من الاتصال بالإنترنت.<br><button class="chip" style="margin-top:10px" onclick="${retry}">إعادة المحاولة</button></div>`;

// ------------------------------------------------------------------ بطاقات المحتوى
function itemCard(i) {
  const fav = st.fav.includes(i.id);
  return `<div class="card" role="button" tabindex="0" onclick="push('item',{item:'${i.id}'})"><span class="badge">${DATA.types[i.type] || ''}</span><button class="heart ${fav ? 'on' : ''}" aria-label="مفضلة" onclick="event.stopPropagation();toggleFav('${i.id}')">${fav ? '♥' : '♡'}</button><div class="ttl">${esc(i.title)}</div>${SACRED(i.type) ? `<div class="q clamp${i.hafs ? ' qh' : ''}">${esc(i.text)}</div>` : `<p class="clamp muted" style="margin:2px 0 0">${esc(i.text)}</p>`}${i.source ? `<span class="src">${esc(i.source)}</span>` : ''}</div>`;
}
function toggleFav(id) { st.fav = st.fav.includes(id) ? st.fav.filter((x) => x !== id) : [id, ...st.fav]; save('fav', st.fav); render(); }
async function shareText(msg) {
  try {
    if (navigator.share) { await navigator.share({ text: msg }); return; }
    await navigator.clipboard.writeText(msg); toast('تم نسخ النص، الصقه في واتساب أو أي مكان');
  } catch (e) {}
}
function shareItem(id) {
  const i = getItem(id); if (!i) return;
  shareText(`${i.title}\n\n${i.text}${i.source ? `\n\n— ${i.source}` : ''}\n\n📲 تطبيق سكينة: ${APP_URL}`);
}

// ------------------------------------------------------------------ الرئيسية
function greeting(h) { return h < 5 ? 'ليلة مباركة' : h < 12 ? 'صباح الإيمان' : h < 17 ? 'نهارك سكينة' : 'مساء الطمأنينة'; }
function hijri() { try { return new Intl.DateTimeFormat('ar-TN-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()); } catch (e) { return ''; } }
function installCard() {
  if (isStandalone() || load('hideInstall', false)) return '';
  return `<div class="card" style="margin-top:14px;border-color:var(--line)"><div class="row"><b style="color:var(--gold)">📲 ثبّت التطبيق على هاتفك</b><button aria-label="إخفاء" class="faint" style="font-size:20px" onclick="save('hideInstall',true);render()">×</button></div><div class="small" style="line-height:1.9;margin-top:4px">${isIOS ? 'في Safari: اضغط زر المشاركة <b>⬆︎</b> ثم <b>«إضافة إلى الشاشة الرئيسية»</b>.' : 'في Chrome: اضغط <b>⋮</b> ثم <b>«تثبيت التطبيق»</b>.'}</div></div>`;
}
function home() {
  const pool = all.filter((i) => i.type === 'ayah' || i.type === 'hadith');
  const d = pool[DAY % pool.length];
  const h = new Date().getHours();
  const np = nextPrayerInfo();
  const morning = h >= 4 && h < 12;
  return `<section class="hero wrap"><div class="row"><div class="hello"><small>السلام عليكم ورحمة الله</small><h1>${greeting(h)}</h1><span class="hij">${esc(hijri())}</span></div>${medal('☪', 'var(--on-hero-2)')}</div>
  ${np ? `<button class="next-prayer" onclick="go('prayer')"><span style="font-size:22px">🕌</span><span><small>الصلاة القادمة${np.city ? ' · ' + esc(np.city) : ''}</small><b>${np.name}</b></span><span class="t num" id="np-left">${np.left}</span></button>` : `<button class="next-prayer" onclick="go('prayer')"><span style="font-size:22px">🕌</span><span><b>أوقات الصلاة والقبلة</b><small>اضغط لتحديد موقعك</small></span></button>`}
  <button class="daily" onclick="push('item',{item:'${d.id}'})"><span class="pill">${d.type === 'ayah' ? 'آية اليوم' : 'حديث اليوم'}</span><div class="q${d.hafs ? ' qh' : ''}" style="margin-top:6px">${esc(d.text)}</div>${orn(120)}<div class="small muted">${esc(d.source)}</div></button></section>
  <div class="wrap">
  <button class="calmbtn" onclick="push('calm')">${medal('🤍')}<div style="flex:1;min-width:0"><b>أشعر بالقلق… لحظة سكينة</b><small>تنفّس مع آية تطمئن قلبك (دقيقتان)</small></div><span class="faint">‹</span></button>
  <div class="quick">
    <button class="card" onclick="openAdhkarKey('${morning ? 'الصباح' : 'الصباح'}')"><span style="font-size:24px">${morning ? '☀️' : '🌙'}</span><b>${morning ? 'أذكار الصباح' : 'أذكار المساء'}</b><small>حصّن يومك</small></button>
    <button class="card" onclick="go('quran')"><span style="font-size:24px">📖</span><b>القرآن الكريم</b><small>${load('lastPage', null) ? 'متابعة من صفحة ' + AR(load('lastPage', 1)) : 'المصحف كاملاً'}</small></button>
  </div>
  ${!load('pushOn', false) && pushSupported() ? `<button class="card" style="display:flex;align-items:center;gap:12px;margin-top:12px;border-color:var(--deco)" onclick="push('rem')"><span style="font-size:24px">🔔</span><div style="flex:1;min-width:0"><b>فعّل الإشعارات</b><div class="small muted">آيات وأذكار وأذان حتى والهاتف مقفل</div></div><span class="faint">‹</span></button>` : ''}
  ${installCard()}
  <h2 class="sec">جديد لك <small><button style="color:var(--gold)" onclick="push('feed')">عرض الكل ‹</button></small></h2>
  <div class="stack" style="padding-block:0">${feedCards(3)}</div>
  <h2 class="sec">الأقسام <small>${AR(DATA.cats.length)} أقسام</small></h2>
  <div class="grid">${DATA.cats.map((c) => `<button class="card cat" onclick="push('cat',{cat:'${c.id}',filter:'all'})">${medal(ICON[c.id] || '✦', c.accent)}<b>${esc(c.title)}</b><small>${esc(c.subtitle)}</small><span class="count">${AR(c.items.length)}</span></button>`).join('')}</div>
  <button class="card" style="display:flex;align-items:center;gap:12px;margin-top:12px" onclick="push('cat',{cat:'sadaqa',filter:'all'})">${medal('❦', '#C07070')}<div style="flex:1;min-width:0"><small style="color:var(--gold);font-weight:700">تحدّي الصدقة اليوم</small><b style="display:block">${esc(DATA.challenges[DAY % DATA.challenges.length])}</b></div><span class="faint">‹</span></button>
  <p class="center faint q" style="font-size:17px;margin-block:22px">﴿أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ﴾</p></div>`;
}
function feedCards(n) {
  const items = FEED.slice(0, n).map(getItem).filter(Boolean);
  if (!items.length) return `<div class="card center muted">${navigator.onLine ? 'جارٍ تحميل محتوى جديد…' : 'اتصل بالإنترنت ليصلك محتوى جديد'}</div>`;
  return items.map(itemCard).join('');
}

// ------------------------------------------------------------------ الأقسام والعناصر
function cat() {
  const c = DATA.cats.find((x) => x.id === st.cat);
  const types = [...new Set(c.items.map((i) => i.type))];
  const items = st.filter === 'all' ? c.items : c.items.filter((i) => i.type === st.filter);
  const n = DATA.challenges.length;
  const idx = [DAY % n, (DAY + 5) % n, (DAY + 9) % n];
  const chal = c.id === 'sadaqa' ? `<div class="card"><b style="color:var(--gold)">تحدّي الصدقة اليومي</b><div class="small muted">اختر صدقة واحدة على الأقل اليوم 🤍</div>${idx.map((k) => `<button class="check" onclick="toggleDone(${k})"><span class="box ${st.done.includes(k) ? 'on' : ''}">${st.done.includes(k) ? '✓' : ''}</span><span style="${st.done.includes(k) ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(DATA.challenges[k])}</span></button>`).join('')}</div>` : '';
  return header(c.title, c.subtitle) + `<div class="wrap stack">${chal}${types.length > 1 ? `<div class="chips">${['all', ...types].map((t) => `<button class="chip ${st.filter === t ? 'on' : ''}" onclick="st.filter='${t}';render()">${t === 'all' ? 'الكل' : DATA.types[t]}</button>`).join('')}</div>` : ''}${items.map(itemCard).join('')}</div>`;
}
function toggleDone(k) { st.done = st.done.includes(k) ? st.done.filter((x) => x !== k) : [...st.done, k]; save('done', st.done); render(); }
function item() {
  const i = getItem(st.item);
  if (!i) return header('غير موجود', '') + `<div class="wrap stack">${loading('هذا المحتوى غير متوفر حالياً')}</div>`;
  const c = i.cat, n = c.items.findIndex((x) => x.id === i.id), prev = c.items[n - 1], next = c.items[n + 1], fav = st.fav.includes(i.id);
  const body = i.body ? esc(i.body).replace(/(﴿[^﴾]*﴾|«[^»]*»)/g, '<em>$1</em>') : '';
  return header(c.title, '') + `<div class="wrap" style="padding-block:16px"><span class="badge">${DATA.types[i.type] || ''}</span><h2 style="margin:8px 0 0;font-size:22px;line-height:1.5">${esc(i.title)}</h2>
  <div class="frame"><div>${SACRED(i.type) ? `<div class="q${i.hafs ? ' qh' : ''}">${esc(i.text)}</div>` : `<div style="font-size:17px;line-height:1.9">${esc(i.text)}</div>`}${i.source ? orn(130) + `<div class="small" style="color:var(--gold);font-weight:600">${esc(i.source)}</div>` : ''}</div></div>
  ${body ? `<div class="card body" style="margin-top:14px">${body}</div>` : ''}
  ${i.chap ? `<button class="ghost" style="margin-top:12px" onclick="push('adhkarc',{dkc:${i.chap}})">📿 فتح باب «${esc(i.title)}» كاملاً</button>` : ''}
  <div class="acts" style="margin-top:16px"><button class="ghost ${fav ? 'on' : ''}" onclick="toggleFav('${i.id}')">${fav ? '♥ في المفضلة' : '♡ أضف للمفضلة'}</button><button class="ghost" onclick="shareItem('${i.id}')">↗ مشاركة</button></div>
  <div class="pn" dir="ltr">${next ? `<button onclick="go('item',{item:'${next.id}'})">‹ ${esc(next.title)}</button>` : '<span style="flex:1"></span>'}${prev ? `<button dir="rtl" onclick="go('item',{item:'${prev.id}'})">› ${esc(prev.title)}</button>` : '<span style="flex:1"></span>'}</div></div>`;
}
function favs() {
  const items = st.fav.map(getItem).filter(Boolean);
  return header('المفضلة', 'ما لامس قلبك، تجده هنا') + `<div class="wrap stack">${items.length ? items.map(itemCard).join('') : `<div class="center muted" style="padding-top:50px"><div style="font-size:48px;color:var(--deco)">♡</div><b>لا يوجد شيء في المفضلة بعد</b><p class="small">اضغط على ♡ في أي آية أو قصة أو ذكر لحفظه هنا</p></div>`}</div>`;
}

// ------------------------------------------------------------------ لحظة سكينة
let calmTimer = null;
function calm() {
  const pool = DATA.cats.find((c) => c.id === 'calm').items;
  if (st.calmIdx == null) st.calmIdx = rnd(pool.length);
  const v = pool[st.calmIdx % pool.length];
  clearInterval(calmTimer);
  const ph = [['شهيق…', 4], ['احبس…', 4], ['زفير…', 6]];
  let p = 0, left = 4;
  calmTimer = setInterval(() => { const el = $('bph'); if (!el) { clearInterval(calmTimer); return; } if (--left <= 0) { p = (p + 1) % 3; left = ph[p][1]; } el.textContent = ph[p][0]; }, 1000);
  return header('لحظة سكينة', 'تنفّس ببطء مع الدائرة، واقرأ الآية بقلبك') + `<div class="wrap" style="padding-block:6px 20px">
  <div class="breath"><span id="bph">شهيق…</span></div><p class="small muted center">شهيق ٤ ثوانٍ · احبس ٤ · زفير ٦ — كرّرها ٦ مرات</p>
  <div class="frame"><div><div class="q qh" style="font-size:24px">${esc(v.text)}</div>${orn(130)}<div class="small" style="color:var(--gold);font-weight:600">${esc(v.source)}</div></div></div>
  <div class="card body center" style="margin-top:12px">${esc(v.body)}</div>
  <div class="card center" style="margin-top:12px"><small class="muted">ردّد مع كل زفير</small><div class="q" style="color:var(--gold)">حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ</div></div>
  <div class="acts" style="margin-top:14px"><button class="ghost" onclick="st.calmIdx=(st.calmIdx||0)+1;render()">🤍 آية أخرى</button><button class="ghost ${st.fav.includes(v.id) ? 'on' : ''}" onclick="toggleFav('${v.id}')">${st.fav.includes(v.id) ? '♥ في المفضلة' : '♡ حفظ'}</button></div></div>`;
}

// ------------------------------------------------------------------ القرآن الكريم
let QDATA = null, OFF = null;
async function qdata() {
  if (QDATA) return QDATA;
  const r = await fetch('quran.json');
  if (!r.ok) throw new Error('quran');
  QDATA = await r.json();
  OFF = [0];
  QDATA.c.forEach((c, i) => OFF.push(OFF[i] + c[2]));
  QDATA.pg = QDATA.p.map(([s, a]) => OFF[s - 1] + a);
  QDATA.jg = QDATA.j.map(([s, a]) => OFF[s - 1] + a);
  return QDATA;
}
const toGlobal = (s, a) => OFF[s - 1] + a;
function fromGlobal(g) { let s = 1; while (OFF[s] < g) s++; return [s, g - OFF[s - 1]]; }
function pageOf(s, a) { const g = toGlobal(s, a); let lo = 0, hi = 603; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (QDATA.pg[m] <= g) lo = m; else hi = m - 1; } return lo + 1; }
function juzOf(g) { let j = 0; while (j < 29 && QDATA.jg[j + 1] <= g) j++; return j + 1; }
const BISM = () => (QDATA ? QDATA.v[0][0] : 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ');

function quran() {
  const v = need('qdata', qdata);
  let body;
  if (v === null) body = loading();
  else if (v === 'ERR') body = errBox("retryKey('qdata')");
  else {
    const lp = load('lastPage', null), lr = load('lastRead', null);
    const cont = st.qmode === 'book' && lp
      ? `<button class="card" style="display:flex;align-items:center;gap:12px" onclick="openPage(${lp})">${medal('۞')}<div style="flex:1"><small style="color:var(--gold);font-weight:700">متابعة القراءة</small><b style="display:block">الصفحة ${AR(lp)} — سورة ${esc(QDATA.c[QDATA.p[lp - 1][0] - 1][0])}</b></div><span class="faint">‹</span></button>`
      : st.qmode === 'scroll' && lr
      ? `<button class="card" style="display:flex;align-items:center;gap:12px" onclick="openSura(${lr.n},${lr.v})">${medal('۞')}<div style="flex:1"><small style="color:var(--gold);font-weight:700">متابعة القراءة</small><b style="display:block">سورة ${esc(QDATA.c[lr.n - 1][0])} — الآية ${AR(lr.v)}</b></div><span class="faint">‹</span></button>` : '';
    const tab = st.qtab || 'sura';
    const list = tab === 'sura'
      ? `<input id="sura-q" class="search" placeholder="ابحث عن سورة…" oninput="filterList('sura-q','.sura')">` + QDATA.c.map((s, i) => `<button class="card sura" data-t="${esc(s[0])} ${i + 1}" onclick="openSura(${i + 1},1)"><span class="snum"><span>${AR(i + 1)}</span></span><span class="sname">${esc(s[0])}</span><span class="smeta">${s[1] === 'm' ? 'مكية' : 'مدنية'} · ${AR(s[2])} آية</span></button>`).join('')
      : QDATA.j.map(([s, a], i) => `<button class="card sura" onclick="openJuz(${i + 1})"><span class="snum"><span>${AR(i + 1)}</span></span><span class="sname" style="font-size:18px">الجزء ${AR(i + 1)}</span><span class="smeta">${esc(QDATA.c[s - 1][0])} ${AR(a)} · ص ${AR(pageOf(s, a))}</span></button>`).join('');
    body = `<div class="card" style="padding:12px"><div class="small muted" style="margin-bottom:6px;font-weight:600">طريقة القراءة</div><div class="seg"><button class="${st.qmode === 'book' ? 'on' : ''}" onclick="setQmode('book')">📖 وضع الكتاب (صفحات)</button><button class="${st.qmode === 'scroll' ? 'on' : ''}" onclick="setQmode('scroll')">📜 وضع التمرير</button></div></div>
      ${cont}<div class="seg"><button class="${tab === 'sura' ? 'on' : ''}" onclick="st.qtab='sura';render()">السور</button><button class="${tab === 'juz' ? 'on' : ''}" onclick="st.qtab='juz';render()">الأجزاء</button></div>${list}`;
  }
  return header('القرآن الكريم', 'مصحف المدينة برواية حفص عن عاصم', { back: false }) + `<div class="wrap stack">${body}<p class="small faint center">النص والخط: مجمع الملك فهد لطباعة المصحف الشريف</p></div>`;
}
function setQmode(m) { st.qmode = m; save('qmode', m); render(); }
function openSura(n, a) { if (!QDATA) return; if (st.qmode === 'book') openPage(pageOf(n, a || 1), n, a || 1); else push('sura', { sura: n, ayah: a || 1 }); }
function openJuz(j) { const [s, a] = QDATA.j[j - 1]; if (st.qmode === 'book') openPage(pageOf(s, a)); else push('sura', { sura: s, ayah: a }); }
function openPage(p, s, a) { push('page', { page: p, sura: s || null, ayah: a || null }); }
function filterList(inputId, sel) { const q = ($(inputId).value || '').trim(); document.querySelectorAll(sel).forEach((el) => { el.hidden = !!q && !el.dataset.t.includes(q); }); }
function readerTools(toggleLabel, toggleFn) {
  return `<div class="reader-tools"><button class="chip" onclick="qsize(-2)" aria-label="تصغير الخط">أ−</button><span class="small muted">حجم الخط</span><button class="chip" onclick="qsize(2)" aria-label="تكبير الخط">أ+</button><button class="chip" onclick="${toggleFn}">${toggleLabel}</button></div>`;
}
function qsize(d) { st.qsize = Math.min(44, Math.max(17, st.qsize + d)); save('qsize', st.qsize); document.querySelectorAll('.mushaf').forEach((m) => (m.style.fontSize = st.qsize + 'px')); }
function ayahSpan(s, a, t) { return `<span class="ay" id="ay-${s}-${a}" onclick="ayahSheet(${s},${a})">${esc(t)} ${AR(a)}</span> `; }

// وضع التمرير
function sura() {
  const v = need('qdata', qdata);
  if (v === null || v === 'ERR') return header('القرآن الكريم', '') + `<div class="wrap stack">${v === null ? loading() : errBox("retryKey('qdata')")}</div>`;
  const n = st.sura, vs = QDATA.v[n - 1], name = QDATA.c[n - 1][0];
  const bism = n !== 1 && n !== 9 ? `<div class="bism" style="font-size:1.05em">${esc(BISM())}</div>` : '';
  const verses = (n === 1 ? vs : vs).map((t, i) => ayahSpan(n, i + 1, t)).join('');
  save('lastRead', { n, v: st.ayah || 1 });
  if (st.ayah > 1) setTimeout(() => { const el = $(`ay-${n}-${st.ayah}`); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('hl'); } }, 80);
  return header('سورة ' + name, 'اضغط على أي آية لقراءة تفسيرها') + `<div class="wrap" style="padding-block:8px 18px">${readerTools('📖 وضع الكتاب', `setQmode('book');go('page',{page:pageOf(${n},${st.ayah || 1})})`)}
  <div class="page"><div class="page-in"><div class="sura-band">سورة ${esc(name)}</div><div class="mushaf" style="font-size:${st.qsize}px">${bism}${verses}</div></div></div>
  <div class="pn" dir="ltr">${n < 114 ? `<button onclick="go('sura',{sura:${n + 1},ayah:1})">‹ السورة التالية</button>` : '<span style="flex:1"></span>'}${n > 1 ? `<button dir="rtl" onclick="go('sura',{sura:${n - 1},ayah:1})">› السورة السابقة</button>` : '<span style="flex:1"></span>'}</div></div>`;
}

// وضع الكتاب
function page() {
  const v = need('qdata', qdata);
  if (v === null || v === 'ERR') return header('القرآن الكريم', '') + `<div class="wrap stack">${v === null ? loading() : errBox("retryKey('qdata')")}</div>`;
  const p = Math.min(604, Math.max(1, st.page)), g0 = QDATA.pg[p - 1], g1 = p < 604 ? QDATA.pg[p] - 1 : 6236;
  let html = '', firstS = null;
  for (let g = g0; g <= g1; g++) {
    const [s, a] = fromGlobal(g);
    if (firstS == null) firstS = s;
    if (a === 1) html += `<div class="sura-band">سورة ${esc(QDATA.c[s - 1][0])}</div>${s !== 1 && s !== 9 ? `<div class="bism">${esc(BISM())}</div>` : ''}`;
    html += ayahSpan(s, a, QDATA.v[s - 1][a - 1]);
  }
  save('lastPage', p);
  const [fs, fa] = fromGlobal(g0);
  save('lastRead', { n: fs, v: fa });
  if (st.sura && st.ayah) { const s0 = st.sura, a0 = st.ayah; setTimeout(() => { const el = $(`ay-${s0}-${a0}`); if (el) el.classList.add('hl'); }, 60); }
  return header(`سورة ${QDATA.c[firstS - 1][0]}`, `الجزء ${AR(juzOf(g0))} · الصفحة ${AR(p)} من ٦٠٤`) + `<div class="wrap" style="padding-block:8px 18px">${readerTools('📜 وضع التمرير', `setQmode('scroll');go('sura',{sura:${fs},ayah:${fa}})`)}
  <div class="page" id="mpage"><div class="page-in"><div class="page-top"><span>سورة ${esc(QDATA.c[firstS - 1][0])}</span><span>الجزء ${AR(juzOf(g0))}</span></div>
  <div class="mushaf" style="font-size:${st.qsize}px">${html}</div><div class="page-foot"><span>${AR(p)}</span></div></div></div>
  <p class="small faint center" style="margin:8px 0 0">اسحب الصفحة يميناً أو يساراً للتنقل</p>
  <div class="pn" dir="ltr">${p < 604 ? `<button onclick="turn(1)">‹ الصفحة التالية</button>` : '<span style="flex:1"></span>'}${p > 1 ? `<button dir="rtl" onclick="turn(-1)">› الصفحة السابقة</button>` : '<span style="flex:1"></span>'}</div>
  <div class="row" style="gap:8px"><input id="goto-p" class="search num" type="number" inputmode="numeric" min="1" max="604" placeholder="رقم الصفحة (١–٦٠٤)"><button class="chip on" onclick="const n=+$('goto-p').value;if(n>=1&&n<=604)go('page',{page:n,sura:null,ayah:null})">اذهب</button></div></div>`;
}
function turn(d) { const p = st.page + d; if (p < 1 || p > 604) return; go('page', { page: p, sura: null, ayah: null }); }
let touchX = null, touchY = null;
document.addEventListener('touchstart', (e) => { if (st.view !== 'page' || !e.target.closest('#mpage')) { touchX = null; return; } touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; }, { passive: true });
document.addEventListener('touchend', (e) => {
  if (touchX == null) return;
  const dx = e.changedTouches[0].clientX - touchX, dy = e.changedTouches[0].clientY - touchY;
  touchX = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(dx > 0 ? 1 : -1); // في المصحف: السحب نحو اليمين = الصفحة التالية
}, { passive: true });

async function ayahSheet(s, a) {
  document.querySelectorAll('.ay.hl').forEach((e) => e.classList.remove('hl'));
  const el = $(`ay-${s}-${a}`); if (el) el.classList.add('hl');
  save('lastRead', { n: s, v: a });
  const nm = QDATA.c[s - 1][0], id = `q-${s}:${a}`, fav = st.fav.includes(id);
  $('sheet').innerHTML = `<div class="sheet-bg" onclick="closeSheet()"></div><div class="sheet" role="dialog" aria-label="تفسير الآية"><div class="grab"></div>
    <div class="row"><b style="color:var(--gold)">سورة ${esc(nm)} — الآية ${AR(a)}</b><button aria-label="إغلاق" onclick="closeSheet()" class="faint" style="font-size:24px">×</button></div>
    <div class="mushaf" style="font-size:24px;margin-top:6px">${esc(QDATA.v[s - 1][a - 1])} ${AR(a)}</div>
    <div id="tafsir" class="body muted" style="margin-top:8px">جارٍ تحميل التفسير…</div>
    <div class="acts" style="margin-top:12px"><button class="ghost ${fav ? 'on' : ''}" id="qfav" onclick="favAyah(${s},${a})">${fav ? '♥ في المفضلة' : '♡ أضف للمفضلة'}</button><button class="ghost" onclick="favAyah(${s},${a},true)">↗ مشاركة</button></div></div>`;
  try {
    const { t } = await loadAyahTafsir(s + ':' + a);
    const box = $('tafsir'); if (box) box.innerHTML = '<b style="color:var(--gold)">التفسير الميسر:</b>\n' + esc(t.text);
  } catch (e) { const box = $('tafsir'); if (box) box.textContent = 'تعذّر تحميل التفسير، تأكد من الاتصال بالإنترنت.'; }
}
function closeSheet() { const s = $('sheet'); if (s) s.innerHTML = ''; }
function favAyah(s, a, share) {
  const nm = QDATA.c[s - 1][0], id = `q-${s}:${a}`;
  const tf = ($('tafsir') || {}).textContent || '';
  addDyn({ id, src: 'quran', type: 'ayah', hafs: true, title: `سورة ${nm} — الآية ${AR(a)}`, text: QDATA.v[s - 1][a - 1], source: `سورة ${nm} - الآية ${a}`, body: tf.startsWith('التفسير') ? tf : '' }, false);
  if (share) { shareItem(id); return; }
  st.fav = st.fav.includes(id) ? st.fav.filter((x) => x !== id) : [id, ...st.fav]; save('fav', st.fav);
  const b = $('qfav'); if (b) { const on = st.fav.includes(id); b.classList.toggle('on', on); b.textContent = on ? '♥ في المفضلة' : '♡ أضف للمفضلة'; }
}

// ------------------------------------------------------------------ أوقات الصلاة (حساب فلكي محلي)
const D2R = Math.PI / 180;
const dsin = (d) => Math.sin(d * D2R), dcos = (d) => Math.cos(d * D2R), dtan = (d) => Math.tan(d * D2R);
const darcsin = (x) => Math.asin(x) / D2R, darccos = (x) => Math.acos(x) / D2R, darctan2 = (y, x) => Math.atan2(y, x) / D2R, darccot = (x) => Math.atan(1 / x) / D2R;
const fixA = (a) => { a = a - 360 * Math.floor(a / 360); return a < 0 ? a + 360 : a; };
const fixH = (a) => { a = a - 24 * Math.floor(a / 24); return a < 0 ? a + 24 : a; };
const METHODS = {
  tunisia: { n: 'تونس (وزارة الشؤون الدينية)', f: 18, i: 18 },
  mwl: { n: 'رابطة العالم الإسلامي', f: 18, i: 17 },
  algeria: { n: 'الجزائر', f: 18, i: 17 },
  morocco: { n: 'المغرب', f: 19, i: 17 },
  egypt: { n: 'الهيئة المصرية العامة للمساحة', f: 19.5, i: 17.5 },
  makkah: { n: 'أم القرى (مكة المكرمة)', f: 18.5, im: 90 },
  france: { n: 'فرنسا (اتحاد المنظمات 12°)', f: 12, i: 12 },
  isna: { n: 'أمريكا الشمالية (ISNA)', f: 15, i: 15 },
};
function julian(y, m, d) { if (m <= 2) { y -= 1; m += 12; } const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4); return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5; }
function sunPos(jd) {
  const D = jd - 2451545.0, g = fixA(357.529 + 0.98560028 * D), q = fixA(280.459 + 0.98564736 * D);
  const L = fixA(q + 1.915 * dsin(g) + 0.02 * dsin(2 * g)), e = 23.439 - 0.00000036 * D;
  const RA = darctan2(dcos(e) * dsin(L), dcos(L)) / 15;
  return { decl: darcsin(dsin(e) * dsin(L)), eqt: q / 15 - fixH(RA) };
}
function prayerTimes(date, lat, lng, methodKey, asrFactor = 1) {
  const M = METHODS[methodKey] || METHODS.tunisia;
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  const jd = julian(y, m, d) - lng / (15 * 24);
  const mid = (t) => fixH(12 - sunPos(jd + t).eqt);
  const angleTime = (ang, t, ccw) => { const { decl } = sunPos(jd + t); const T = darccos((-dsin(ang) - dsin(decl) * dsin(lat)) / (dcos(decl) * dcos(lat))) / 15; const n = mid(t); return n + (ccw ? -T : T); };
  const asrTime = (f, t) => { const { decl } = sunPos(jd + t); return angleTime(-darccot(f + dtan(Math.abs(lat - decl))), t); };
  let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18 };
  for (let k = 0; k < 2; k++) {
    const p = Object.fromEntries(Object.entries(t).map(([kk, v]) => [kk, v / 24]));
    t = {
      fajr: angleTime(M.f, p.fajr, true), sunrise: angleTime(0.833, p.sunrise, true), dhuhr: mid(p.dhuhr),
      asr: asrTime(asrFactor, p.asr), sunset: angleTime(0.833, p.sunset), isha: M.im ? 0 : angleTime(M.i, p.isha),
    };
  }
  const night = 24 - (t.sunset - t.sunrise);
  if (isNaN(t.fajr)) t.fajr = t.sunrise - night / 7;
  if (M.im) t.isha = t.sunset + M.im / 60; else if (isNaN(t.isha)) t.isha = t.sunset + night / 7;
  const base = Date.UTC(y, m - 1, d);
  const toDate = (h, addMin = 0) => new Date(base + (h - lng / 15) * 3600e3 + addMin * 60e3);
  return { fajr: toDate(t.fajr), sunrise: toDate(t.sunrise), dhuhr: toDate(t.dhuhr, 1), asr: toDate(t.asr), maghrib: toDate(t.sunset, 1), isha: toDate(t.isha) };
}
const PR = [['fajr', 'الفجر', '🌅'], ['sunrise', 'الشروق', '☀️'], ['dhuhr', 'الظهر', '🕛'], ['asr', 'العصر', '🌤️'], ['maghrib', 'المغرب', '🌇'], ['isha', 'العشاء', '🌙']];
const CITIES = [
  ['تونس العاصمة', 36.8065, 10.1815], ['أريانة', 36.8625, 10.1956], ['بن عروس', 36.7531, 10.2189], ['منوبة', 36.8101, 10.0956], ['نابل', 36.4561, 10.7376], ['زغوان', 36.4029, 10.1429], ['بنزرت', 37.2744, 9.8739], ['باجة', 36.7256, 9.1817], ['جندوبة', 36.5011, 8.7802], ['الكاف', 36.1822, 8.7148], ['سليانة', 36.0849, 9.3708], ['سوسة', 35.8256, 10.6084], ['المنستير', 35.7643, 10.8113], ['المهدية', 35.5047, 11.0622], ['صفاقس', 34.7406, 10.7603], ['القيروان', 35.6781, 10.0963], ['القصرين', 35.1676, 8.8365], ['سيدي بوزيد', 35.0382, 9.4849], ['قابس', 33.8815, 10.0982], ['مدنين', 33.3549, 10.5055], ['جربة', 33.8076, 10.8451], ['تطاوين', 32.9297, 10.4518], ['قفصة', 34.425, 8.7842], ['توزر', 33.9197, 8.1335], ['قبلي', 33.7044, 8.969],
  ['الجزائر العاصمة', 36.7538, 3.0588], ['الدار البيضاء', 33.5731, -7.5898], ['طرابلس', 32.8872, 13.1913], ['القاهرة', 30.0444, 31.2357], ['مكة المكرمة', 21.4225, 39.8262], ['المدينة المنورة', 24.4672, 39.6111], ['باريس', 48.8566, 2.3522], ['مرسيليا', 43.2965, 5.3698], ['ليون', 45.764, 4.8357], ['روما', 41.9028, 12.4964], ['برلين', 52.52, 13.405], ['مونتريال', 45.5017, -73.5673],
];
function distKm(a1, o1, a2, o2) { const R = 6371, dLa = (a2 - a1) * D2R, dLo = (o2 - o1) * D2R; const h = Math.sin(dLa / 2) ** 2 + Math.cos(a1 * D2R) * Math.cos(a2 * D2R) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
function nearestCity(lat, lng) { let best = null, bd = 1e9; for (const c of CITIES) { const d = distKm(lat, lng, c[1], c[2]); if (d < bd) { bd = d; best = c; } } return bd < 35 ? best[0] : null; }
function qiblaBearing(lat, lng) { const K = [21.4225, 39.8262]; const dL = (K[1] - lng) * D2R; return fixA(Math.atan2(Math.sin(dL), Math.cos(lat * D2R) * Math.tan(K[0] * D2R) - Math.sin(lat * D2R) * Math.cos(dL)) / D2R); }
const fmtT = (d) => d.toLocaleTimeString('ar-TN-u-nu-arab', { hour: '2-digit', minute: '2-digit', hour12: false });
function fmtLeft(ms) { const m = Math.max(0, Math.round(ms / 60000)); const h = Math.floor(m / 60), mm = m % 60; return h ? `${AR(h)} س ${AR(mm)} د` : `${AR(mm)} د`; }
function getLoc() { return load('loc', null); }
function todayTimes(offsetDays = 0) {
  const L = getLoc(); if (!L) return null;
  const d = new Date(); d.setDate(d.getDate() + offsetDays);
  return prayerTimes(d, L.lat, L.lng, load('method', 'tunisia'), load('asr', 1));
}
function nextPrayerInfo() {
  const L = getLoc(); if (!L) return null;
  const now = Date.now(), t = todayTimes(0);
  for (const [k, n] of PR) { if (k === 'sunrise') continue; if (t[k].getTime() > now) return { key: k, name: n, at: t[k], left: fmtLeft(t[k] - now), city: L.name }; }
  const tm = todayTimes(1);
  return { key: 'fajr', name: 'الفجر', at: tm.fajr, left: fmtLeft(tm.fajr - now), city: L.name };
}
function locate() {
  if (!navigator.geolocation) { toast('هذا الجهاز لا يدعم تحديد الموقع، اختر مدينتك من القائمة'); return; }
  toast('جارٍ تحديد موقعك…');
  navigator.geolocation.getCurrentPosition(
    (p) => { const lat = p.coords.latitude, lng = p.coords.longitude; save('loc', { lat, lng, name: nearestCity(lat, lng) || 'موقعي الحالي' }); toast('تم تحديد موقعك ✅'); render(); syncPush(); },
    (e) => { toast(e.code === 1 ? 'لم يتم السماح بالموقع. فعّله من الإعدادات أو اختر مدينتك من القائمة' : 'تعذّر تحديد الموقع، اختر مدينتك من القائمة'); },
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 3600e3 }
  );
}
function setCity(i) { const c = CITIES[+i]; if (c) { save('loc', { lat: c[1], lng: c[2], name: c[0] }); render(); syncPush(); } }
function prayer() {
  const L = getLoc();
  const method = load('method', 'tunisia'), asr = load('asr', 1);
  const citySel = `<select class="search" aria-label="اختر مدينة" onchange="setCity(this.value)"><option value="">اختر مدينة من القائمة…</option>${CITIES.map((c, i) => `<option value="${i}" ${L && L.name === c[0] ? 'selected' : ''}>${c[0]}</option>`).join('')}</select>`;
  if (!L) {
    return header('أوقات الصلاة والقبلة', '', { back: false }) + `<div class="wrap stack"><div class="card center"><div style="font-size:44px">🕌</div><b style="font-size:17px">حدّد موقعك لحساب أوقات الصلاة واتجاه القبلة</b><p class="small muted">يُستعمل موقعك على هاتفك فقط ولا يُرسل لأي جهة.</p><button class="cta" onclick="locate()">📍 حدّد موقعي تلقائياً</button></div><div class="card"><b class="small muted">أو اختر مدينتك</b><div style="margin-top:8px">${citySel}</div></div></div>`;
  }
  const t = todayTimes(0), np = nextPrayerInfo(), now = Date.now();
  const rows = PR.map(([k, n, ic]) => `<div class="prow ${np.key === k && np.at.toDateString() === new Date().toDateString() ? 'next' : t[k] < now ? 'past' : ''}"><span class="ic">${ic}</span><b>${n}</b><span class="tm num">${fmtT(t[k])}</span></div>`).join('');
  const qb = qiblaBearing(L.lat, L.lng), km = Math.round(distKm(L.lat, L.lng, 21.4225, 39.8262));
  return `<header class="hdr wrap" style="padding-bottom:18px"><div class="row"><span class="hph"></span><h1>أوقات الصلاة</h1><span class="hph"></span></div><p>📍 ${esc(L.name)} · ${esc(hijri())}</p>
    <div class="countdown"><div class="small" style="color:var(--on-hero-muted)">متبقٍّ على صلاة ${np.name}</div><div class="big num" id="pr-left">${np.left}</div><div class="small" style="color:var(--on-hero-muted)">${fmtT(np.at)}</div></div></header>
  <div class="wrap stack"><div class="ptable">${rows}</div>
  <div class="card" style="text-align:center"><b style="font-size:17px">🧭 اتجاه القبلة</b><p class="small muted" style="margin:2px 0 0">${AR(Math.round(qb))}° من الشمال باتجاه عقارب الساعة · المسافة إلى مكة ${AR(km.toLocaleString('en'))} كم</p>
    <div class="compass" id="compass">${compassSVG(qb)}</div><p class="small" id="qibla-msg">${hasCompass ? '' : 'وجّه أعلى الهاتف نحو الشمال، فيكون السهم الذهبي نحو القبلة.'}</p>
    ${hasCompass ? '' : `<button class="ghost" onclick="startCompass()">🧭 تفعيل البوصلة الحية</button>`}</div>
  <div class="card"><b>⚙️ الإعدادات</b><div class="small muted" style="margin-top:8px">الموقع</div><div class="acts" style="margin-top:4px"><button class="ghost" onclick="locate()">📍 موقعي الحالي</button></div><div style="margin-top:8px">${citySel}</div>
    <div class="small muted" style="margin-top:10px">طريقة الحساب</div><select class="search" onchange="save('method',this.value);render();syncPush()">${Object.entries(METHODS).map(([k, m]) => `<option value="${k}" ${k === method ? 'selected' : ''}>${m.n}</option>`).join('')}</select>
    <div class="small muted" style="margin-top:10px">صلاة العصر</div><div class="seg"><button class="${asr === 1 ? 'on' : ''}" onclick="save('asr',1);render();syncPush()">الجمهور (المالكي…)</button><button class="${asr === 2 ? 'on' : ''}" onclick="save('asr',2);render();syncPush()">الحنفي</button></div>
    <p class="small faint" style="margin:10px 0 0">الأوقات محسوبة فلكياً وقد تختلف بدقيقة أو دقيقتين عن تقويم مسجدك. عند الاختلاف اعتمد تقويم بلدك الرسمي.</p></div></div>`;
}
function compassSVG(qb) {
  const ticks = Array.from({ length: 72 }, (_, i) => { const a = i * 5, long = a % 30 === 0; return `<line x1="130" y1="${long ? 14 : 18}" x2="130" y2="24" transform="rotate(${a} 130 130)" style="stroke:var(--faint);stroke-width:${long ? 2 : 1}"/>`; }).join('');
  return `<svg viewBox="0 0 260 260" id="dial" aria-hidden="true"><circle cx="130" cy="130" r="124" style="fill:var(--surface2);stroke:var(--line)"/>${ticks}
    <text x="130" y="44" text-anchor="middle" style="fill:#C0392B;font:700 18px var(--f-ui)">ش</text><text x="222" y="136" text-anchor="middle" style="fill:var(--muted);font:700 15px var(--f-ui)">ق</text><text x="130" y="228" text-anchor="middle" style="fill:var(--muted);font:700 15px var(--f-ui)">ج</text><text x="38" y="136" text-anchor="middle" style="fill:var(--muted);font:700 15px var(--f-ui)">غ</text>
    <g transform="rotate(${qb} 130 130)"><path d="M130 40 L141 130 L130 122 L119 130 Z" style="fill:var(--deco)"/><path d="M130 220 L141 130 L130 138 L119 130 Z" style="fill:var(--faint)" opacity=".5"/><text x="130" y="34" text-anchor="middle" style="font-size:18px">🕋</text></g>
    <circle cx="130" cy="130" r="6" style="fill:var(--text)"/></svg>`;
}
let hasCompass = false, lastHeading = null;
async function startCompass() {
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const r = await DeviceOrientationEvent.requestPermission();
      if (r !== 'granted') { toast('لم يتم السماح بالبوصلة'); return; }
    }
  } catch (e) {}
  const onOri = (e) => {
    let h = null;
    if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading;
    else if (e.absolute && typeof e.alpha === 'number') h = 360 - e.alpha;
    if (h == null) return;
    hasCompass = true; lastHeading = h;
    const dial = $('dial'), msg = $('qibla-msg'); if (!dial) return;
    dial.style.transform = `rotate(${-h}deg)`;
    const L = getLoc(); if (!L || !msg) return;
    const diff = Math.abs(((qiblaBearing(L.lat, L.lng) - h + 540) % 360) - 180);
    msg.innerHTML = diff < 5 ? '<span class="qibla-ok">✅ أنت متجه نحو القبلة</span>' : `أدِر الهاتف حتى يشير السهم الذهبي إلى الأعلى (${AR(Math.round(diff))}°)`;
  };
  window.addEventListener('deviceorientationabsolute', onOri, true);
  window.addEventListener('deviceorientation', onOri, true);
  setTimeout(() => { if (!hasCompass) toast('البوصلة غير متوفرة على هذا الجهاز'); else render(); }, 2500);
}

// ------------------------------------------------------------------ الأذكار (حصن المسلم)
let ADHKAR = null;
async function adhkarData() {
  if (ADHKAR) return ADHKAR;
  try { const r = await fetch('adhkar.json'); if (r.ok) { ADHKAR = await r.json(); return ADHKAR; } } catch (e) {}
  const cached = load('adhkarCache', null);
  if (cached && cached.length > 100) { ADHKAR = cached; return ADHKAR; }
  const idx = await api('https://www.hisnmuslim.com/api/ar/husn_ar.json');
  const list = idx['العربية'];
  const out = [];
  await Promise.all(list.map(async (c) => {
    try {
      const j = await api(String(c.TEXT).replace('http:', 'https:'));
      const k = Object.keys(j)[0];
      out.push({ id: c.ID, t: c.TITLE, items: (j[k] || []).map((x) => ({ id: x.ID, x: String(x.ARABIC_TEXT || '').trim(), r: +x.REPEAT || 1 })) });
    } catch (e) {}
  }));
  out.sort((a, b) => a.id - b.id);
  if (!out.length) throw new Error('adhkar');
  ADHKAR = out; save('adhkarCache', out);
  return ADHKAR;
}
const FEATURED = [['الصباح', '☀️🌙', 'أذكار الصباح والمساء'], ['النوم', '😴', 'أذكار النوم'], ['الاستيقاظ', '🌄', 'أذكار الاستيقاظ'], ['بعد السلام', '🕌', 'بعد الصلاة'], ['الهم', '💚', 'الهم والحزن'], ['الكرب', '🤲', 'دعاء الكرب'], ['السفر', '✈️', 'دعاء السفر'], ['الطعام', '🍽️', 'الطعام والشراب']];
function findChap(key) { return ADHKAR && ADHKAR.find((c) => c.t.includes(key)); }
async function openAdhkarKey(key) {
  try { await adhkarData(); } catch (e) { push('adhkar'); return; }
  const c = findChap(key); if (c) push('adhkarc', { dkc: c.id }); else push('adhkar');
}
function adhkar() {
  const v = need('adhkar', adhkarData);
  let body;
  if (v === null) body = loading('جارٍ تحميل الأذكار… (مرة واحدة فقط، ثم تعمل بدون إنترنت)');
  else if (v === 'ERR') body = errBox("retryKey('adhkar')");
  else {
    const feat = FEATURED.map(([k, e, label]) => { const c = findChap(k); return c ? `<button class="card" onclick="push('adhkarc',{dkc:${c.id}})"><span class="e">${e}</span><b>${label}</b></button>` : ''; }).join('');
    body = `<div class="feat">${feat}</div><h2 class="sec" style="margin-top:8px">كل الأبواب <small>${AR(v.length)} باباً</small></h2>
      <input id="dk-q" class="search" placeholder="ابحث: النوم، المسجد، المطر، المريض…" oninput="filterList('dk-q','.dkr')">
      ${v.map((c) => `<button class="card dkr" data-t="${esc(c.t)}" onclick="push('adhkarc',{dkc:${c.id}})"><b>${esc(c.t)}</b><span class="src">${AR(c.items.length)} ${c.items.length > 10 ? 'ذكراً' : 'أذكار'}</span></button>`).join('')}`;
  }
  return header('الأذكار', 'من الكتاب والسنة الصحيحة — حصن المسلم', { back: false }) + `<div class="wrap stack">${body}<p class="small faint center">المصدر: حصن المسلم للشيخ سعيد بن علي بن وهف القحطاني رحمه الله</p></div>`;
}
let DKC = {};
function adhkarc() {
  const v = need('adhkar', adhkarData);
  if (v === null || v === 'ERR') return header('الأذكار', '') + `<div class="wrap stack">${v === null ? loading() : errBox("retryKey('adhkar')")}</div>`;
  const c = v.find((x) => x.id === st.dkc);
  if (!c) return header('الأذكار', '') + `<div class="wrap stack">${loading('غير موجود')}</div>`;
  const key = 'dkc-' + c.id + '-' + new Date().toDateString();
  DKC = load(key, {});
  const total = c.items.reduce((s, x) => s + x.r, 0), done = c.items.reduce((s, x) => s + Math.min(DKC[x.id] || 0, x.r), 0);
  const cards = c.items.map((x) => {
    const n = DKC[x.id] || 0, ok = n >= x.r;
    return `<div class="card dk ${ok ? 'done' : ''}" id="dk-${x.id}"><div class="q">${esc(x.x)}</div>
      <button class="counter" onclick="countDk(${c.id},${x.id},${x.r})">${ok ? '✓ تمّ' : `<span>اضغط للعدّ</span><span class="num">${AR(n)} / ${AR(x.r)}</span>`}</button>
      <div class="row" style="margin-top:8px"><button class="small" style="color:var(--gold);font-weight:600" onclick="shareText(${esc(JSON.stringify(x.x + '\n\n— حصن المسلم\n📲 ' + APP_URL))})">↗ مشاركة</button><button class="small" style="color:var(--gold);font-weight:600" onclick="favDk(${c.id},${x.id})">${st.fav.includes('d-' + x.id) ? '♥ محفوظ' : '♡ حفظ'}</button></div></div>`;
  }).join('');
  return header(c.t, '') + `<div class="wrap stack"><div class="card"><div class="row"><b class="small">تقدّمك اليوم</b><span class="small num" style="color:var(--gold);font-weight:700">${AR(done)} / ${AR(total)}</span></div><div class="prog"><i style="width:${Math.round((done / total) * 100)}%"></i></div>${done ? `<button class="small faint" style="margin-top:6px" onclick="save('${key}',{});render()">↺ إعادة العدّ</button>` : ''}</div>${cards}</div>`;
}
function countDk(cid, id, r) {
  const key = 'dkc-' + cid + '-' + new Date().toDateString();
  DKC = load(key, {}); DKC[id] = Math.min(r, (DKC[id] || 0) + 1); save(key, DKC);
  try { navigator.vibrate && navigator.vibrate(DKC[id] >= r ? [30, 40, 30] : 12); } catch (e) {}
  const y = window.scrollY; render(); window.scrollTo(0, y);
}
function favDk(cid, id) {
  const c = ADHKAR.find((x) => x.id === cid), x = c.items.find((i) => i.id === id);
  addDyn(dhikrItem(c, x), false);
  const y = window.scrollY; toggleFav('d-' + id); window.scrollTo(0, y);
}

// ------------------------------------------------------------------ السبحة
const ADH = [['سُبْحَانَ اللَّهِ', 33], ['الْحَمْدُ لِلَّهِ', 33], ['اللَّهُ أَكْبَرُ', 34], ['لَا إِلَهَ إِلَّا اللَّهُ', 100], ['أَسْتَغْفِرُ اللَّهَ', 100], ['سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', 100], ['اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ', 100], ['لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ', 100]];
function tasbih() {
  const [t, target] = ADH[st.dh], C = 2 * Math.PI * 110, p = Math.min(st.count / target, 1);
  return header('السبحة', '«ألا أنبئكم بخير أعمالكم… ذكر الله» — رواه الترمذي') + `<div class="wrap" style="padding-block:14px"><div class="chips">${ADH.map((a, k) => `<button class="chip ${k === st.dh ? 'on' : ''}" onclick="st.dh=${k};st.count=0;render()">${a[0]}</button>`).join('')}</div>
  <div class="dh">${t}</div><button class="tb" aria-label="سبّح" onclick="tap()"><svg viewBox="0 0 250 250" aria-hidden="true"><polygon points="${starPts(125, 123, 0.86)}" style="fill:var(--gold-soft);stroke:var(--line)"/><circle cx="125" cy="125" r="110" style="fill:none;stroke:var(--line-s);stroke-width:8"/><circle cx="125" cy="125" r="110" style="fill:none;stroke:var(--deco);stroke-width:8;stroke-linecap:round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - p)}" transform="rotate(-90 125 125)"/><circle cx="125" cy="125" r="92" style="fill:var(--surface)"/></svg><span><b class="num">${st.count}</b><small>من ${target}</small></span></button>
  <p class="small muted center">اضغط على الدائرة للتسبيح</p><div class="row" style="justify-content:center;margin-top:12px"><button class="chip" onclick="st.count=0;render()">↺ إعادة</button><div class="card" style="width:auto;padding:6px 22px;text-align:center"><small class="muted">مجموع تسبيحاتك</small><div class="num" style="font-size:20px;font-weight:700;color:var(--gold)">${st.total}</div></div></div></div>`;
}
function tap() { st.count++; st.total++; save('total', st.total); try { navigator.vibrate && navigator.vibrate(st.count === ADH[st.dh][1] ? [30, 40, 30] : 8); } catch (e) {} render(); }

// ------------------------------------------------------------------ التذكيرات
function rem() {
  const hh = (h) => String(h).padStart(2, '0') + ':00';
  const s = st.set;
  const sw = (k) => `<button class="sw ${s[k] ? 'on' : ''}" role="switch" aria-checked="${!!s[k]}" aria-label="تبديل" onclick="st.set.${k}=!st.set.${k};saveSet()"></button>`;
  return header('التذكيرات', 'تذكير لطيف يعيد قلبك إلى الله') + `<div class="wrap stack">
  ${pushCard()}
  <div class="card"><b>⚙️ إعدادات التذكيرات</b><div class="row" style="margin-top:8px"><div><div style="font-weight:600">تذكيرات الآيات والأذكار</div><div class="small muted">آية، حديث، ذكر أو قصة</div></div>${sw('enabled')}</div>
    <div class="row" style="margin-top:12px"><div><div style="font-weight:600">تنبيه الأذان 🕌</div><div class="small muted">${getLoc() ? 'عند دخول وقت كل صلاة · ' + esc(getLoc().name) : 'يحتاج تحديد موقعك في صفحة الصلاة'}</div></div>${sw('adhan')}</div>
    <div class="small muted" style="margin-top:10px">كل قدّاش؟</div><div class="wrapchips" style="margin-top:4px">${[[30, 'كل 30 دقيقة'], [60, 'كل ساعة'], [120, 'كل ساعتين']].map(([v, l]) => `<button class="chip ${s.interval === v ? 'on' : ''}" onclick="st.set.interval=${v};saveSet()">${l}</button>`).join('')}</div>
    <div class="row" style="margin-top:12px"><span>لا تزعجني وقت النوم</span>${sw('quiet')}</div>
    ${s.quiet ? `<div class="small muted" style="margin-top:6px">من الساعة</div><div class="wrapchips">${[21, 22, 23, 0].map((h) => `<button class="chip ${s.qs === h ? 'on' : ''}" onclick="st.set.qs=${h};saveSet()">${hh(h)}</button>`).join('')}</div><div class="small muted" style="margin-top:6px">إلى الساعة</div><div class="wrapchips">${[5, 6, 7, 8].map((h) => `<button class="chip ${s.qe === h ? 'on' : ''}" onclick="st.set.qe=${h};saveSet()">${hh(h)}</button>`).join('')}</div>` : ''}</div>
  <div class="card"><b>مواضيع التذكيرات</b>${DATA.cats.map((c) => { const on = s.cats.includes(c.id); return `<button class="check" onclick="toggleCat('${c.id}')"><span class="box ${on ? 'on' : ''}">${on ? '✓' : ''}</span><span>${ICON[c.id] || ''}</span><span style="color:${on ? 'var(--text)' : 'var(--muted)'}">${esc(c.title)}</span></button>`; }).join('')}</div>
  <button class="cta" onclick="demoNotif()">🔔 جرّب تذكيراً الآن</button></div>`;
}
function saveSet() { save('set', st.set); render(); syncPush(); }
function toggleCat(id) { const n = st.set.cats.includes(id) ? st.set.cats.filter((x) => x !== id) : [...st.set.cats, id]; if (n.length) st.set.cats = n; saveSet(); }
async function askNotif() {
  if (!('Notification' in window)) { toast(isIOS && !isStandalone() ? 'أضف التطبيق إلى الشاشة الرئيسية أولاً' : 'هذا المتصفح لا يدعم الإشعارات'); return; }
  const p = await Notification.requestPermission(); toast(p === 'granted' ? 'تم تفعيل الإشعارات ✅' : 'لم يتم السماح بالإشعارات');
}
let tt;
function toast(body, title = 'سكينة', id) {
  const el = $('toast');
  el.innerHTML = `<div class="toast" role="status" ${id ? `onclick="push('item',{item:'${id}'});this.remove()" style="cursor:pointer"` : ''}>${medal('☪')}<div style="min-width:0"><b>${esc(title)}</b><span>${esc(body)}</span></div></div>`;
  clearTimeout(tt); tt = setTimeout(() => (el.innerHTML = ''), 5500);
}
function pickReminder() {
  const pool = [...DATA.cats.filter((c) => st.set.cats.includes(c.id)).flatMap((c) => (c.id === 'calm' ? [...c.items, ...c.items] : c.items)), ...FEED.slice(0, 60).map((id) => DYN[id]).filter(Boolean)];
  const i = pool[rnd(pool.length)];
  const T = { ayah: '📖 آية تطمئن قلبك', hadith: '🌿 من هدي النبي ﷺ', dhikr: '📿 ذكر: ', story: '✨ قصة: ', lesson: '🕌 تعلّم: ', tip: '🤲 ' }[i.type] || '';
  const title = i.hafs && i.cat ? '🤍 ' + i.title : i.type === 'ayah' || i.type === 'hadith' ? T : T + i.title;
  let b = i.notif || i.text; if (b.length > 170) b = b.slice(0, 167) + '…';
  return { i, title, b };
}
function demoNotif() { const { i, title, b } = pickReminder(); toast(b, title, i.id); }
function inQuiet(d) { if (!st.set.quiet) return false; const h = d.getHours(), a = st.set.qs, b = st.set.qe; return a < b ? h >= a && h < b : h >= a || h < b; }
let lastPrayerToast = load('lastPrToast', '');
function tick() {
  // أذان داخل التطبيق
  const np = getLoc() && todayTimes(0);
  if (np) {
    const now = Date.now();
    for (const [k, n] of PR) {
      if (k === 'sunrise') continue;
      const tk = np[k].getTime(), id = np[k].toDateString() + k;
      if (now >= tk && now - tk < 10 * 60e3 && lastPrayerToast !== id) { lastPrayerToast = id; save('lastPrToast', id); toast(`حان الآن وقت صلاة ${n} 🕌`, 'حيّ على الصلاة'); if (!load('pushOn', false)) notifyOS(`حان وقت صلاة ${n}`, 'حيّ على الصلاة، حيّ على الفلاح'); }
    }
    const el = $('np-left') || $('pr-left'); if (el) { const x = nextPrayerInfo(); el.textContent = x.left; }
  }
  if (!st.set.enabled || load('pushOn', false)) return;
  const now = Date.now(), last = load('lastRem', 0);
  if (!last) { save('lastRem', now); return; }
  if (now - last >= st.set.interval * 60000 && !inQuiet(new Date())) {
    save('lastRem', now);
    const { i, title, b } = pickReminder();
    toast(b, title, i.id); notifyOS(title, b);
  }
}
function notifyOS(title, body) {
  try { if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker) navigator.serviceWorker.ready.then((r) => r.showNotification(title, { body, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'sakina' })); } catch (e) {}
}


// ------------------------------------------------------------------ إشعارات حتى والهاتف مقفل (Web Push)
// المفتاح العام للخادم، والصندوق الذي تُرسل إليه الاشتراكات مشفّرة (لا يقرؤها إلا الخادم)
const VAPID_PUBLIC = 'BGxNolnkX9er5YIikloj-LVfXv7hEju__lEKC7porn0-W1_tK-f-_rdFpPyBxa0DXPXh-FCAnDySdB32FYrye24';
const MAILBOX = 'https://ntfy.sh/sakina-mb-19ymgc2fku3t';
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!(window.crypto && crypto.subtle);
async function sealForServer(obj) {
  const server = await crypto.subtle.importKey('raw', unb64u(VAPID_PUBLIC), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: server }, eph.privateKey, 256);
  const key = await crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', bits), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  return b64u(await crypto.subtle.exportKey('raw', eph.publicKey)) + '.' + b64u(iv) + '.' + b64u(ct);
}
function pushPrefs() {
  const L = getLoc();
  return {
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Tunis',
    on: !!st.set.enabled, iv: st.set.interval, q: st.set.quiet ? [st.set.qs, st.set.qe] : null, cats: st.set.cats,
    adhan: !!st.set.adhan && !!L, loc: L ? [Math.round(L.lat * 100) / 100, Math.round(L.lng * 100) / 100] : null,
    m: load('method', 'tunisia'), asr: load('asr', 1),
  };
}
async function sendToServer(op, sub) {
  const body = await sealForServer({ op, sub: sub.toJSON ? sub.toJSON() : sub, p: pushPrefs(), v: 1 });
  const r = await fetch(MAILBOX, { method: 'POST', body });
  if (!r.ok) throw new Error('mailbox ' + r.status);
  save('pushSent', Date.now());
}
async function enablePush() {
  if (isIOS && !isStandalone()) { toast('على iPhone: أضف التطبيق أولاً إلى الشاشة الرئيسية، ثم افتحه من الأيقونة وفعّل الإشعارات من هنا'); return; }
  if (!pushSupported()) { toast('هذا المتصفح لا يدعم الإشعارات. على iPhone حدّث النظام إلى iOS 16.4 أو أحدث'); return; }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { toast('لم يتم السماح بالإشعارات. فعّلها من إعدادات الهاتف ← سكينة ← الإشعارات'); return; }
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(VAPID_PUBLIC) });
    await sendToServer('sub', sub);
    save('pushOn', true);
    reg.showNotification('تم تفعيل الإشعارات ✅', { body: 'ستصلك الآيات والأذكار حتى والهاتف مقفل. أول تذكير يصلك قريباً بإذن الله 🤍', icon: 'icon-192.png', badge: 'icon-192.png', tag: 'sakina-welcome' });
    render();
  } catch (e) { toast('تعذّر التفعيل، تأكد من الاتصال بالإنترنت ثم أعد المحاولة'); }
}
async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) { await sendToServer('unsub', sub).catch(() => {}); await sub.unsubscribe(); }
  } catch (e) {}
  save('pushOn', false); toast('تم إيقاف الإشعارات'); render();
}
let syncT = null;
function syncPush(force) {
  if (!load('pushOn', false) || !pushSupported()) return;
  clearTimeout(syncT);
  syncT = setTimeout(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) { save('pushOn', false); return; }
      await sendToServer('sub', sub);
    } catch (e) {}
  }, force ? 500 : 2500);
}
function pushCard() {
  const on = load('pushOn', false);
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  if (on && perm === 'granted') {
    return `<div class="card" style="border:1.5px solid var(--deco)"><b style="font-size:17px;color:var(--ok)">✅ الإشعارات مفعّلة حتى والهاتف مقفل</b><p class="small muted" style="margin:4px 0 0">تصلك الآيات والأذكار${st.set.adhan && getLoc() ? ' وتنبيه الأذان' : ''} على شاشة القفل. أي تغيير في الإعدادات تحت يُحفظ تلقائياً.</p><button class="ghost" style="margin-top:10px" onclick="disablePush()">إيقاف الإشعارات</button></div>`;
  }
  const iosHelp = isIOS && !isStandalone()
    ? `<ol class="steps small"><li>افتح التطبيق في <b>Safari</b>.</li><li>اضغط زر المشاركة <b>⬆︎</b> ثم <b>«إضافة إلى الشاشة الرئيسية»</b>.</li><li>افتح سكينة من <b>الأيقونة</b> الجديدة، وارجع إلى هذه الصفحة.</li><li>اضغط الزر الأخضر واختر <b>«سماح»</b>.</li></ol>` : '';
  return `<div class="card" style="border:1.5px solid var(--deco)"><b style="font-size:17px;color:var(--gold)">🔒 إشعارات حتى والهاتف مقفل</b>
    <p class="small" style="margin:4px 0 0">آيات الطمأنينة والأذكار وتنبيه الأذان تصلك على شاشة القفل مثل رسائل واتساب، على iPhone وAndroid.</p>${iosHelp}
    <button class="cta" style="margin-top:10px" onclick="enablePush()">🔔 فعّل الإشعارات</button>
    ${perm === 'denied' ? '<p class="small" style="color:#B3261E;margin:8px 0 0">الإشعارات ممنوعة لهذا التطبيق. افتح إعدادات الهاتف ← الإشعارات ← سكينة ← سماح.</p>' : ''}</div>`;
}

// ------------------------------------------------------------------ المكتبة والجديد
function lib() {
  return header('المكتبة المتجددة', 'آلاف الأحاديث مع شرحها، وآيات مع تفسيرها') + `<div class="wrap stack">
  <div class="card"><b style="color:var(--gold);font-size:16px">📜 الأحاديث النبوية</b><p class="small muted" style="margin:2px 0 10px">مع درجتها وشرحها وفوائدها — موسوعة الأحاديث النبوية</p><div class="wrapchips">${H_ROOTS.map((r) => `<button class="chip" onclick="push('hcat',{libCat:${r.id},libPage:1})">${r.t}</button>`).join('')}</div></div>
  <button class="card" onclick="push('rayah')"><b style="color:var(--gold);font-size:16px">📖 آية وتفسير</b><p class="small muted" style="margin:2px 0 0">آية عشوائية من القرآن مع التفسير الميسر</p></button>
  <button class="card" onclick="push('feed')"><b style="color:var(--gold);font-size:16px">✨ الجديد</b><p class="small muted" style="margin:2px 0 0">كل ما وصل تلقائياً من أحاديث وآيات وأذكار</p></button></div>`;
}
function feed() { return header('الجديد', 'يتجدّد تلقائياً كل بضع ساعات') + `<div class="wrap stack"><button class="cta" onclick="moreFeed(this)">✨ حمّل محتوى جديداً الآن</button>${feedCards(60)}</div>`; }
async function moreFeed(btn) { if (btn) { btn.disabled = true; btn.textContent = 'جارٍ التحميل…'; } await refreshFeed(true); render(); }
function hcat() {
  const r = H_ROOTS.find((x) => x.id === st.libCat);
  let html = '', last = null, total = 0;
  for (let p = 1; p <= st.libPage; p++) {
    const key = `hl-${st.libCat}-${p}`;
    const v = need(key, () => api(`https://hadeethenc.com/api/v1/hadeeths/list/?language=ar&category_id=${st.libCat}&page=${p}&per_page=20`));
    if (v === null) { html += loading(); break; }
    if (v === 'ERR') { html += errBox(`retryKey('${key}')`); break; }
    total = +v.meta.total_items; last = v;
    html += v.data.map((h) => `<button class="card" onclick="openHadith('${h.id}',this)"><span class="badge">حديث</span><div class="ttl">${esc(h.title)}</div></button>`).join('');
  }
  const more = last && st.libPage < +last.meta.last_page ? `<button class="cta" onclick="st.libPage++;render()">تحميل المزيد ↓</button>` : '';
  return header(r.t, total ? AR(total) + ' حديث' : 'أحاديث نبوية') + `<div class="wrap stack">${html}${more}<p class="small faint center">المصدر: موسوعة الأحاديث النبوية HadeethEnc.com</p></div>`;
}
async function openHadith(id, el) { if (el) el.style.opacity = 0.6; try { const it = await loadHadith(id); push('item', { item: it.id }); } catch (e) { toast('تعذّر فتح الحديث، تأكد من الاتصال بالإنترنت'); if (el) el.style.opacity = 1; } }
function rayah() {
  const key = 'rayah-' + (st.rk || 0);
  const v = need(key, randomAyah);
  const body = v === null ? loading('جارٍ اختيار آية…') : v === 'ERR' ? errBox(`retryKey('${key}')`) :
    `<div class="frame"><div><div class="q qh">${esc(v.text)}</div>${orn(130)}<div class="small" style="color:var(--gold);font-weight:600">${esc(v.source)}</div></div></div><div class="card body" style="margin-top:12px">${esc(v.body)}</div>
     <div class="acts" style="margin-top:12px"><button class="ghost ${st.fav.includes(v.id) ? 'on' : ''}" onclick="toggleFav('${v.id}')">${st.fav.includes(v.id) ? '♥ في المفضلة' : '♡ أضف للمفضلة'}</button><button class="ghost" onclick="shareItem('${v.id}')">↗ مشاركة</button></div>`;
  return header('آية وتفسير', 'التفسير الميسر') + `<div class="wrap" style="padding-block:16px">${body}<button class="cta" style="margin-top:14px" onclick="st.rk=(st.rk||0)+1;render()">📖 آية أخرى</button></div>`;
}

// ------------------------------------------------------------------ المزيد
function more() {
  const link = (v, e, t, s) => `<button class="card" style="display:flex;align-items:center;gap:12px" onclick="push('${v}')"><span style="font-size:24px">${e}</span><div style="flex:1;min-width:0"><b>${t}</b><div class="small muted">${s}</div></div><span class="faint">‹</span></button>`;
  return header('المزيد', '', { back: false }) + `<div class="wrap stack">
  <div class="card"><b>🎨 المظهر</b><div class="seg" style="margin-top:8px"><button class="${st.theme === 'light' ? 'on' : ''}" onclick="setTheme('light')">☀️ فاتح</button><button class="${st.theme === 'dark' ? 'on' : ''}" onclick="setTheme('dark')">🌙 داكن</button><button class="${st.theme === 'auto' ? 'on' : ''}" onclick="setTheme('auto')">📱 تلقائي</button></div></div>
  ${link('rem', '🔔', 'التذكيرات والإشعارات', 'حتى والهاتف مقفل')}
  ${link('favs', '♥', 'المفضلة', AR(st.fav.length) + ' عنصر محفوظ')}
  ${link('tasbih', '📿', 'السبحة', 'عدّاد التسبيح')}
  ${link('calm', '🤍', 'لحظة سكينة', 'تمرين تنفّس مع آية')}
  ${link('lib', '📚', 'المكتبة المتجددة', 'أحاديث مع الشرح، آيات مع التفسير')}
  ${installCard()}
  <p class="small faint center">سكينة — صدقة جارية. شارك التطبيق: <span class="code">${esc(APP_URL.replace('https://', ''))}</span></p>
  <button class="ghost" onclick="shareText('🌙 تطبيق سكينة: القرآن، أوقات الصلاة والقبلة، الأذكار، وآيات تطمئن القلب. مجاني 🤍\\n'+APP_URL)">↗ شارك التطبيق</button></div>`;
}

// ------------------------------------------------------------------ الرسم
const TABS = [
  ['home', 'الرئيسية', 'M12 3l9 7v11h-6v-6H9v6H3V10z'],
  ['quran', 'القرآن', 'M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-7a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h7z'],
  ['prayer', 'الصلاة', 'M12 2l2 3h-4zM6 21V11a6 6 0 0 1 12 0v10M3 21h18M10 21v-4a2 2 0 0 1 4 0v4'],
  ['adhkar', 'الأذكار', 'M12 4a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm-6 5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm12 0a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm-6 6a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z'],
  ['more', 'المزيد', 'M4 6h16M4 12h16M4 18h16'],
];
const VIEWS = { home, cat, item, favs, tasbih, rem, quran, sura, page, lib, feed, hcat, rayah, calm, prayer, adhkar, adhkarc, more };
const TAB_OF = { home: 'home', cat: 'home', item: null, calm: 'home', feed: 'home', quran: 'quran', sura: 'quran', page: 'quran', prayer: 'prayer', adhkar: 'adhkar', adhkarc: 'adhkar', more: 'more', rem: 'more', favs: 'more', tasbih: 'more', lib: 'more', hcat: 'more', rayah: 'more' };
function render() {
  $('app').innerHTML = (VIEWS[st.view] || home)();
  const top = TAB_OF[st.view];
  $('tabs').innerHTML = TABS.map(([k, l, d]) => `<button class="tab ${top === k ? 'on' : ''}" aria-current="${top === k ? 'page' : 'false'}" onclick="stack=[];go('${k}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${top === k ? 2.2 : 1.6}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>${l}</button>`).join('');
}

// روابط الإشعارات: ‎#i-ID‎ (محتوى) ، ‎#a-كلمة‎ (باب أذكار) ، ‎#calm‎ ، ‎#prayer‎
function openFromHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (!h) return;
  history.replaceState(null, '', APP_URL);
  if (h.startsWith('i-')) push('item', { item: h.slice(2) });
  else if (h.startsWith('a-')) openAdhkarKey(h.slice(2));
  else if (VIEWS[h]) push(h);
}

applyTheme();
render();
openFromHash();
window.addEventListener('hashchange', openFromHash);
setInterval(tick, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); refreshFeed(); if (st.view === 'prayer' || st.view === 'home') render(); } });
window.addEventListener('online', () => refreshFeed());
setTimeout(() => refreshFeed(), 900);
setTimeout(() => { if (load('pushOn', false) && Date.now() - load('pushSent', 0) > 7 * 86400e3) syncPush(true); }, 3000);
setTimeout(() => qdata().catch(() => {}), 1500);
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
