// خادم الإشعارات: يعمل على GitHub Actions كل 5 دقائق
// 1) يقرأ الاشتراكات الجديدة (مشفّرة) من الصندوق  2) يرسل التذكيرات والأذان لكل مشترك حسب إعداداته
import fs from 'node:fs';
import crypto from 'node:crypto';
import webpush from 'web-push';

const APP = 'https://moslinky.github.io/sakina/';
const PUB = 'BGxNolnkX9er5YIikloj-LVfXv7hEju__lEKC7porn0-W1_tK-f-_rdFpPyBxa0DXPXh-FCAnDySdB32FYrye24';
const MAILBOX = 'sakina-mb-19ymgc2fku3t';
const PRIV = process.env.VAPID_PRIVATE;
if (!PRIV) { console.error('VAPID_PRIVATE secret is missing'); process.exit(1); }
webpush.setVapidDetails(APP, PUB, PRIV);

const SUBS_FILE = 'push/subs.enc';
const STATE_FILE = '.state/state.json';
const KEY = crypto.createHash('sha256').update('sakina-subs:' + PRIV).digest();

function encrypt(obj) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj)), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}
function decrypt(b64) {
  const buf = Buffer.from(b64, 'base64'), d = crypto.createDecipheriv('aes-256-gcm', KEY, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString());
}
// يفك رسالة الصندوق المشفّرة من التطبيق (ECDH P-256 + AES-GCM)
export function openSealed(msg, priv = PRIV) {
  const [eph, iv, ct] = msg.trim().split('.').map((x) => Buffer.from(x, 'base64url'));
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(Buffer.from(priv, 'base64url'));
  const key = crypto.createHash('sha256').update(ecdh.computeSecret(eph)).digest();
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(ct.subarray(ct.length - 16));
  return JSON.parse(Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]).toString());
}

// ---------------------------------------------------------------- حساب أوقات الصلاة (نفس حساب التطبيق)
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

const PR = [['fajr', 'الفجر'], ['dhuhr', 'الظهر'], ['asr', 'العصر'], ['maghrib', 'المغرب'], ['isha', 'العشاء']];

function localParts(date, tz) {
  try {
    const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const o = Object.fromEntries(f.formatToParts(date).map((p) => [p.type, p.value]));
    return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour, min: +o.minute };
  } catch (e) { return localParts(date, 'Africa/Tunis'); }
}
const inQuiet = (h, q) => { if (!q) return false; const [a, b] = q; if (a === b) return false; return a < b ? h >= a && h < b : h >= a || h < b; };

// ---------------------------------------------------------------- التحميل
let db = { subs: {} };
if (fs.existsSync(SUBS_FILE)) { try { db = decrypt(fs.readFileSync(SUBS_FILE, 'utf8')); } catch (e) { console.error('cannot decrypt subs (key changed?)'); } }
let state = { since: '12h', last: {} };
if (fs.existsSync(STATE_FILE)) { try { state = { ...state, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }; } catch (e) {} }
const msgs = JSON.parse(fs.readFileSync(new URL('./messages.json', import.meta.url), 'utf8'));
let changed = false;
const welcome = [];

// ---------------------------------------------------------------- 1) الاشتراكات الجديدة
try {
  const r = await fetch(`https://ntfy.sh/${MAILBOX}/json?poll=1&since=${encodeURIComponent(state.since || '12h')}`);
  const text = r.ok ? await r.text() : '';
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let ev; try { ev = JSON.parse(line); } catch (e) { continue; }
    if (ev.event !== 'message' || !ev.message) continue;
    state.since = ev.id;
    let m; try { m = openSealed(ev.message); } catch (e) { continue; }
    if (!m || !m.sub || !m.sub.endpoint || !/^https:\/\//.test(m.sub.endpoint)) continue;
    const h = crypto.createHash('sha256').update(m.sub.endpoint).digest('hex').slice(0, 20);
    if (m.op === 'unsub') { if (db.subs[h]) { delete db.subs[h]; changed = true; } continue; }
    if (m.op === 'sub') {
      const isNew = !db.subs[h];
      db.subs[h] = { s: m.sub, p: m.p || {}, t: Date.now() };
      changed = true;
      if (isNew) welcome.push(h);
    }
  }
} catch (e) { console.error('mailbox error', e.message); }
const ids = Object.keys(db.subs);
if (ids.length > 20000) { for (const h of ids.sort((a, b) => db.subs[a].t - db.subs[b].t).slice(0, ids.length - 20000)) delete db.subs[h]; changed = true; }

// ---------------------------------------------------------------- 2) الإرسال
const now = new Date();
const slot = Math.floor(now.getTime() / 1800e3); // نصف ساعة
const jobs = [];
for (const [h, sub] of Object.entries(db.subs)) {
  const p = sub.p || {}, tz = p.tz || 'Africa/Tunis', L = (state.last[h] ||= {});
  const lp = localParts(now, tz), dayKey = `${lp.y}-${lp.m}-${lp.d}`;
  const out = [];
  if (welcome.includes(h)) out.push({ title: '🤍 أهلاً بك في سكينة', body: 'تم تفعيل التذكيرات. ستصلك الآيات والأذكار حتى والهاتف مقفل بإذن الله.', url: APP, tag: 'welcome' });
  // الأذان
  if (p.adhan && Array.isArray(p.loc)) {
    const t = prayerTimes(new Date(Date.UTC(lp.y, lp.m - 1, lp.d, 12)), p.loc[0], p.loc[1], p.m || 'tunisia', p.asr || 1, true);
    for (const [k, n] of PR) {
      const diff = now - t[k];
      if (diff >= 0 && diff < 25 * 60e3 && L.pr !== dayKey + k) {
        L.pr = dayKey + k;
        out.push({ title: `🕌 حان وقت صلاة ${n}`, body: 'حيّ على الصلاة، حيّ على الفلاح. «أقرب ما يكون العبد من ربه وهو ساجد»', url: APP + '#prayer', tag: 'adhan' });
      }
    }
  }
  // التذكيرات
  const iv = p.iv || 60;
  const due = iv === 30 || (iv === 60 && lp.min < 30) || (iv === 120 && lp.h % 2 === 0 && lp.min < 30);
  if (p.on !== false && L.slot !== slot && due && !inQuiet(lp.h, p.q)) {
    L.slot = slot;
    let m = null;
    if (lp.h === 7 && L.am !== dayKey) { L.am = dayKey; m = { title: '☀️ أذكار الصباح', body: 'ابدأ يومك بأذكار الصباح، دقائق قليلة تمنحك السكينة والحفظ طوال اليوم 🤍', url: APP + '#a-الصباح', tag: 'adhkar' }; }
    else if (lp.h === 17 && L.pm !== dayKey) { L.pm = dayKey; m = { title: '🌙 أذكار المساء', body: 'حان وقت أذكار المساء. «أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ»', url: APP + '#a-الصباح', tag: 'adhkar' }; }
    else if (lp.h === 22 && L.nt !== dayKey) { L.nt = dayKey; m = { title: '😴 أذكار النوم', body: 'قبل أن تنام: آية الكرسي والمعوذات وأذكار النوم، ونم مطمئن القلب.', url: APP + '#a-النوم', tag: 'adhkar' }; }
    else {
      const cats = Array.isArray(p.cats) && p.cats.length ? p.cats : null;
      const pool = msgs.filter((x) => !cats || cats.includes(x.c));
      const weighted = pool.concat(pool.filter((x) => x.c === 'calm')); // آيات الطمأنينة بنصيب مضاعف
      const x = weighted.length ? weighted[(slot * 7919 + parseInt(h.slice(0, 6), 16)) % weighted.length] : msgs[slot % msgs.length];
      m = { title: x.t, body: x.m, url: APP + '#i-' + x.id, tag: 'sakina' };
    }
    out.push(m);
  }
  for (const m of out) jobs.push([h, m]);
}
let sent = 0, gone = 0;
for (let i = 0; i < jobs.length; i += 25) {
  await Promise.all(jobs.slice(i, i + 25).map(async ([h, m]) => {
    if (!db.subs[h]) return;
    try { await webpush.sendNotification(db.subs[h].s, JSON.stringify(m), { TTL: 1800, urgency: m.tag === 'adhan' ? 'high' : 'normal' }); sent++; }
    catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) { delete db.subs[h]; delete state.last[h]; changed = true; gone++; }
      else console.error('send error', e.statusCode || '', (e.body || e.message || '').toString().slice(0, 120));
    }
  }));
}
for (const h of Object.keys(state.last)) if (!db.subs[h]) delete state.last[h];

// ---------------------------------------------------------------- الحفظ
fs.mkdirSync('.state', { recursive: true });
fs.writeFileSync(STATE_FILE, JSON.stringify(state));
if (changed) { fs.mkdirSync('push', { recursive: true }); fs.writeFileSync(SUBS_FILE, encrypt(db)); }
console.log(`subscribers=${Object.keys(db.subs).length} sent=${sent} removed=${gone} new=${welcome.length} changed=${changed}`);
