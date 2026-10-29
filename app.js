// Otiyot+ Press — app logic. Plain JS, runs from file:// in Chrome/Edge.

/* ───────── Pure logic (no DOM) ───────── */
const NIKUD = [
  { k: 'shva_na',   n: 'Shva Na',   c: '#cc0000', m: '\u05B0' },
  { k: 'shva_nach', n: 'Shva Nach', c: '#ff88aa', m: '\u05B0' },
  { k: 'hiriq',     n: 'Hiriq',     c: '#ff9900', m: '\u05B4' },
  { k: 'tsere',     n: 'Tsere',     c: '#cccc00', m: '\u05B5' },
  { k: 'segol',     n: 'Segol',     c: '#00cc00', m: '\u05B6' },
  { k: 'patach',    n: 'Patach',    c: '#6aa84f', m: '\u05B7' },
  { k: 'kamatz',    n: 'Kamatz',    c: '#6fa8dc', m: '\u05B8' },
  { k: 'holam',     n: 'Holam',     c: '#0000ff', m: '\u05B9' },
  { k: 'kubutz',    n: 'Kubutz',    c: '#9900ff', m: '\u05BB' },
  { k: 'dagesh',    n: 'Dagesh',    c: '#ff00ff', m: '\u05BC' }
];
const TROPES = [
  { k: 'etnachta',   n: 'Etnachta',    c: '#e5484d', m: '\u0591' },
  { k: 'segol_t',    n: 'Segol',       c: '#ff6d00', m: '\u0592' },
  { k: 'shalshelet', n: 'Shalshelet',  c: '#8d5524', m: '\u0593' },
  { k: 'zaqef_q',    n: 'Zaqef Qatan', c: '#ff9900', m: '\u0594' },
  { k: 'zaqef_g',    n: 'Zaqef Gadol', c: '#cccc00', m: '\u0595' },
  { k: 'tipcha',     n: 'Tipcha',      c: '#00cc00', m: '\u0596' },
  { k: 'revia',      n: 'Revia',       c: '#29abe2', m: '\u0597' },
  { k: 'ole',        n: 'Ole',         c: '#c45c26', m: '\u0598' },
  { k: 'pashta',     n: 'Pashta',      c: '#6fa8dc', m: '\u0599' },
  { k: 'yetiv',      n: 'Yetiv',       c: '#6aa84f', m: '\u059A' },
  { k: 'tevir',      n: 'Tevir',       c: '#9900ff', m: '\u059B' },
  { k: 'geresh',     n: 'Geresh',      c: '#ff00ff', m: '\u059C' },
  { k: 'geresh_m',   n: 'Geresh M.',   c: '#d500f9', m: '\u059D' },
  { k: 'gershayim',  n: 'Gershayim',   c: '#e8b840', m: '\u059E' },
  { k: 'qarney',     n: 'Qarney Para', c: '#795548', m: '\u059F' },
  { k: 'telisha_g',  n: 'Telisha G.',  c: '#6f42c1', m: '\u05A0' },
  { k: 'pazer',      n: 'Pazer',       c: '#00bcd4', m: '\u05A1' },
  { k: 'atnah_h',    n: 'Atnah Haf.',  c: '#e91e63', m: '\u05A2' },
  { k: 'munach',     n: 'Munach',      c: '#a3d977', m: '\u05A3' },
  { k: 'mahpach',    n: 'Mahpach',     c: '#ff88aa', m: '\u05A4' },
  { k: 'mercha',     n: 'Mercha',      c: '#cc0000', m: '\u05A5' },
  { k: 'mercha_k',   n: 'Mercha Kef.', c: '#b71c1c', m: '\u05A6' },
  { k: 'darga',      n: 'Darga',       c: '#555555', m: '\u05A7' },
  { k: 'qadma',      n: 'Qadma',       c: '#0000ff', m: '\u05A8' },
  { k: 'telisha_q',  n: 'Telisha Q.',  c: '#999999', m: '\u05A9' },
  { k: 'yerach',     n: 'Yerach',      c: '#607d8b', m: '\u05AA' },
  { k: 'ole_v',      n: 'Ole veYored', c: '#ff5722', m: '\u05AB' },
  { k: 'iluy',       n: 'Iluy',        c: '#009688', m: '\u05AC' },
  { k: 'dehi',       n: 'Dehi',        c: '#3f51b5', m: '\u05AD' },
  { k: 'zarqa',      n: 'Zarqa',       c: '#0d2340', m: '\u05AE' }
];
const MARK_KEY = {
  '\u05B1': 'segol', '\u05B2': 'patach', '\u05B3': 'kamatz', '\u05B4': 'hiriq', '\u05B5': 'tsere',
  '\u05B6': 'segol', '\u05B7': 'patach', '\u05B8': 'kamatz', '\u05C7': 'kamatz',
  '\u05B9': 'holam', '\u05BA': 'holam', '\u05BB': 'kubutz', '\u05BC': 'dagesh'
};
const TROPE_KEY = Object.fromEntries(TROPES.map(t => [t.m, t.k]));
const LONG = new Set(['tsere', 'kamatz', 'holam']);
const FINAL = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const normRoot = s => [...s].map(c => FINAL[c] || c).join('');
const WORD_RE = /(?:[\u05D0-\u05EA][\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]*)+/g;
const CL_RE = /([\u05D0-\u05EA])([\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]*)/g;
const TROPE_RE = /[\u0591-\u05AF]/;
const STAM_RE = /[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g; // niqqud + trope, keeps maqaf / sof pasuk
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stripMarks = s => s.replace(/[\u0591-\u05C7]/g, '');

function clusters(word) { return [...word.matchAll(CL_RE)].map(m => ({ b: m[1], marks: [...m[2]] })); }

function shvaKey(cl, i) {
  const sv = j => cl[j] && cl[j].marks.includes('\u05B0');
  if (i === 0) return 'shva_na';
  if (i === cl.length - 1 || sv(i + 1)) return 'shva_nach';
  // Two consecutive identical letters: shva under the first is na (e.g. הִלְּלוּ)
  if (cl[i + 1] && cl[i].b === cl[i + 1].b) return 'shva_na';
  if (sv(i - 1)) return 'shva_na';
  const p = cl[i - 1];
  const pk = p.marks.map(m => MARK_KEY[m]).find(k => k && k !== 'dagesh');
  // Vav + patach/kamatz + yod + shva (וַיְהִי, וַיְדַבֵּר): the shva is na
  if (p.b === 'ו' && (p.marks.includes('\u05B7') || p.marks.includes('\u05B8')) &&
      cl[i].b === 'י') return 'shva_na';
  const shuruk = !pk && p.b === 'ו' && p.marks.includes('\u05BC');
  return (LONG.has(pk) || shuruk) ? 'shva_na' : 'shva_nach';
}
function clusterKeys(cl) {
  cl.forEach((c, i) => {
    let key = null;
    for (const m of c.marks) { const k = MARK_KEY[m]; if (k && k !== 'dagesh') { key = k; break; } }
    if (!key && c.marks.includes('\u05B0')) key = shvaKey(cl, i);
    // Shuruk: וּ (vav + dagesh, no other vowel) → kubutz color, not dagesh
    if (!key && c.marks.includes('\u05BC')) {
      key = (c.b === 'ו') ? 'kubutz' : 'dagesh';
    }
    c.key = key;
  });
}

// Shoresh search: does this consonant string contain `target` as a root? Returns letter indexes or null.
// Allows prefixes (ו ש ה ב כ ל מ), common suffixes, and extra letters inside the stem.
// Weak letters (אהוינתמי) are preferred; non-weak extras are allowed but cost more so
// tight / morphological matches still win (e.g. בראשית → ברא, כתובים → כתב).
const PRE = new Set([...'ושהבכלמ']);
const SUF = new Set(['', 'ה', 'ו', 'י', 'כ', 'ם', 'ן', 'ת', 'ים', 'ות', 'הו', 'הם', 'הן', 'ני', 'נו', 'כם', 'כן',
  'תי', 'תם', 'תן', 'יו', 'יה', 'ינו', 'יהם', 'יהן', 'תיו']);
const WEAK = new Set([...'אהוינתמי']);
const MAX_EXTRA = 3; // tightened from 5 — 2-letter roots were matching almost anything
function combos(n, L, cb) {
  const idx = [];
  (function go(s) {
    if (idx.length === L) { cb(idx.slice()); return; }
    for (let i = s; i < n; i++) { idx.push(i); go(i + 1); idx.pop(); }
  })(0);
}
const _rootCache = new Map();
const ROOT_CACHE_MAX = 200000;
function rootHits(cons, t) {
  const k = t + '|' + cons;
  let r = _rootCache.get(k);
  if (r !== undefined) return r;
  r = rootHitsRaw(cons, t);
  if (_rootCache.size >= ROOT_CACHE_MAX) _rootCache.clear();
  _rootCache.set(k, r);
  return r;
}
function rootHitsRaw(cons, t) {
  const n = cons.length, L = t.length;
  if (L < 2 || L > 5 || n < L) return null;
  // Quick reject: the target letters must appear in order inside the word, or no match is possible.
  { let j = 0; for (let i = 0; i < n && j < L; i++) if (cons[i] === t[j]) j++; if (j < L) return null; }
  let best = null, bs = 1e9;
  for (let p = 0; p <= 3 && p < n; p++) {
    if (p > 0 && !PRE.has(cons[p - 1])) break;
    for (let s = 0; s <= 4 && n - s - p >= L; s++) {
      if (!SUF.has(cons.slice(n - s))) continue;
      const stem = cons.slice(p, n - s);
      const extra = stem.length - L;
      if (extra > MAX_EXTRA) continue;
      // Fast path: exact match (no extras)
      if (extra === 0) {
        if (stem === t) {
          const sc = p + s;
          if (sc < bs) { bs = sc; best = Array.from({length: L}, (_, i) => i + p); }
        }
        continue;
      }
      combos(stem.length, L, idx => {
        if (idx.some((si, j) => stem[si] !== t[j])) return;
        // Prefer weak extras; still allow non-weak (score them higher)
        let nonWeak = 0;
        for (let i = 0; i < stem.length; i++) {
          if (!idx.includes(i) && !WEAK.has(stem[i])) nonWeak++;
        }
        const sc = extra * 2 + nonWeak * 4 + p + s;
        if (sc < bs) { bs = sc; best = idx.map(i => i + p); }
      });
    }
  }
  return best;
}

const _wordCache = new Map();
const WORD_CACHE_MAX = 80000;
function wordHTML(word) {
  let h = _wordCache.get(word);
  if (h !== undefined) return h;
  h = wordHTMLRaw(word);
  if (_wordCache.size >= WORD_CACHE_MAX) _wordCache.clear();
  _wordCache.set(word, h);
  return h;
}
function wordHTMLRaw(word) {
  const cl = clusters(word);
  clusterKeys(cl);
  const cons = cl.map(c => FINAL[c.b] || c.b).join('');
  // Collect every trope that appears anywhere in the word so we can highlight the whole word
  const wordTropes = new Set();
  const letterSpans = cl.map(c => {
    const tropKeys = c.marks.filter(m => TROPE_RE.test(m)).map(m => TROPE_KEY[m]).filter(Boolean);
    tropKeys.forEach(k => wordTropes.add(k));
    // Full slice = base + all marks as ONE text node (font anchors marks correctly).
    // Otiyot+ overlay technique — Chrome paints combining marks with the base letter's
    // colour, so marks cannot be coloured by wrapping them alone:
    //   .nk-full  letter+all marks (coloured bottom layer)
    //   .top-nv   letter + tropes + shin/sin (no vowels) — ink top for Niqqud-only
    //   .top-nt   letter + vowels + shin/sin (no tropes) — ink top for Trope marks-only
    // CSS picks which top layer is visible; block/word modes hide both.
    const slice = c.b + c.marks.join('');
    let topNv = c.b; // no vowels
    let topNt = c.b; // no tropes
    for (const m of c.marks) {
      if (TROPE_RE.test(m) || m === '\u05C1' || m === '\u05C2' || m === '\u05BF') topNv += m;
      if (!TROPE_RE.test(m)) topNt += m;
    }
    const tpClass = tropKeys.length ? ' tp' + tropKeys.map(k => ' tp-' + k).join('') : '';
    const keyClass = c.key ? ' k-' + c.key : '';
    // Holam / shuruk on ו: colour the whole letter (Otiyot+ isColoredVav) — no niqqud overlay
    const colorWhole = c.b === 'ו' && (c.key === 'holam' || c.key === 'kubutz');
    const needOb = (c.key && !colorWhole) || tropKeys.length;
    if (!needOb) {
      return `<span class="c${keyClass}${tpClass}">${slice}</span>`;
    }
    return `<span class="c ob${keyClass}${tpClass}">` +
      `<span class="nk-full">${slice}</span>` +
      `<span class="top top-nv" aria-hidden="true">${topNv}</span>` +
      `<span class="top top-nt" aria-hidden="true">${topNt}</span>` +
      `</span>`;
  }).join('');
  const wordTpClass = wordTropes.size ? ' tp' + [...wordTropes].map(k => ' tp-' + k).join('') : '';
  return `<span class="w${wordTpClass}" data-c="${cons}">` + letterSpans + '</span>';
}
/** Cache processed HTML so re-renders of the same verse (e.g. toggling Rashi) stay cheap. */
const _textHtmlCache = new Map();
const TEXT_HTML_CACHE_MAX = 4000;
function textHTML(t) {
  const key = t;
  let hit = _textHtmlCache.get(key);
  if (hit !== undefined) return hit;
  let out = '', last = 0;
  for (const m of t.matchAll(WORD_RE)) { out += esc(t.slice(last, m.index)) + wordHTML(m[0]); last = m.index + m[0].length; }
  hit = out + esc(t.slice(last));
  if (_textHtmlCache.size >= TEXT_HTML_CACHE_MAX) {
    // Drop oldest ~half to keep memory bounded
    const drop = Math.floor(TEXT_HTML_CACHE_MAX / 2);
    let i = 0;
    for (const k of _textHtmlCache.keys()) {
      if (i++ >= drop) break;
      _textHtmlCache.delete(k);
    }
  }
  _textHtmlCache.set(key, hit);
  return hit;
}

function toChapters(node, label = '') {
  if (typeof node === 'string') return [{ label, verses: [node] }];
  if (Array.isArray(node)) {
    node = node.filter(x => x != null);
    if (node.every(x => typeof x === 'string')) return [{ label, verses: node }];
    return node.flatMap((c, i) => toChapters(c, label ? label + ':' + (i + 1) : String(i + 1)));
  }
  if (node && typeof node === 'object') return Object.keys(node).flatMap(k => toChapters(node[k], k));
  return [];
}

/** Nice display names for Siddur section keys — geared toward educators
 *  of K-12 dyslexic religious kids (clear, familiar Yeshivish / school names). */
const SIDDUR_NAME_MAP = {
  // Top-level / services
  'Weekday': 'Weekday',
  'Shabbat': 'Shabbos',
  'Festivals': 'Yom Tov',
  'Berachot': 'Berachos',
  'Kaddish': 'Kaddish',
  'Shacharit': 'Shacharis',
  'Minchah': 'Mincha',
  'Maariv': 'Maariv',
  'Kabbalat Shabbat': 'Kabbalas Shabbos',
  'Shabbat Evening': 'Shabbos Evening',
  'Musaf LeShabbat': 'Musaf for Shabbos',
  'Daytime Meal': 'Daytime Seudah',
  'Third Meal': 'Seudah Shelishis',
  'Havdalah': 'Havdalah',
  'Rosh Chodesh': 'Rosh Chodesh',
  'Shalosh Regalim': 'Shalosh Regalim',
  'Prayer for Dew': 'Tefillas Tal',
  'Prayer for Rain': 'Tefillas Geshem',
  'Sukkot': 'Sukkos',
  'Chanukah': 'Chanukah',
  'Selichot': 'Selichos',
  'Birkat HaMazon': 'Birkas HaMazon',
  'Birkat Hanehenin': 'Birkas Hanehenin',
  'Birkhot Hamitzvot': 'Birkos HaMitzvos',
  'Asher Yatzar Etchem Badin': 'Asher Yatzar (after cemetery)',
  'Tefillat HaDerech': 'Tefillas HaDerech',
  'Havinenu': 'Havinenu',
  'Half Kaddish': 'Chatzi Kaddish',
  "Mourner's Kaddish": 'Kaddish Yasom',
  'Kaddish Shalem': 'Kaddish Shalem',
  "Kaddish d'Rabbanan": "Kaddish d'Rabbanan",
  'Kaddish achar HaKevura': 'Kaddish after Burial',
  'Kaddish achar Hashlamat Meschet': 'Kaddish after completing a Masechta',

  // Preparatory / morning
  'Preparatory Prayers': 'Preparatory Prayers',
  'Waking Prayers': 'Modeh Ani & Waking Prayers',
  'Tzitzit and Tallit': 'Tzitzis & Tallis',
  'Tefillin': 'Tefillin',
  'Birchot HaTorah': 'Birchos HaTorah',
  'Opening Piyutim': 'Opening Piyutim',
  'Birchot HaShachar and Related': 'Birchos HaShachar',
  'Korbanot': 'Korbanos',

  // Pesukei D'Zimra pieces (exactly what teachers want to pick/skip)
  'Pesukei Dezimra': "Pesukei D'Zimra",
  'Introductory Psalm': 'Introductory Psalm',
  "Barukh She'amar": "Baruch She'amar",
  'Hodu': 'Hodu',
  'Mizmor Letoda': 'Mizmor LeTodah',
  'Yehi Chevod': 'Yehi Chevod',
  'Ashrei': 'Ashrei',
  'Psalm 146': 'Hallelu-kah (146)',
  'Psalm 147': 'Hallelu-kah (147)',
  'Psalm 148': 'Hallelu-kah (148)',
  'Psalm 149': 'Hallelu-kah (149)',
  'Psalm 150': 'Hallelu-kah (150)',
  'Closing Verses': 'Closing Verses',
  'Vayevarech David': 'Vayevarech David',
  'Ata Hu': 'Ata Hu',
  'Az Yashir': 'Az Yashir',
  'Yishtabach': 'Yishtabach',
  'Psalm 130': 'Shir HaMaalos (130)',

  // Shema & Amidah
  'Blessings of the Shema': 'Birchos Krias Shema',
  'Barchu': 'Barchu',
  'First Blessing before Shema': '1st Bracha before Shema',
  'Second Blessing before Shema': '2nd Bracha before Shema',
  'Shema': 'Shema',
  'Blessing after Shema': 'Bracha after Shema',
  'Amidah': 'Shemoneh Esrei',
  'Patriarchs': 'Avos',
  'Divine Might': 'Gevuros',
  'Holiness of God': 'Kedushas HaShem',
  'Kedushah': 'Kedushah',
  'Knowledge': 'Ata Chonen',
  'Repentance': 'Hashiveinu',
  'Forgiveness': 'Selach Lanu',
  'Redemption': 'Reeh Na',
  'Healing': 'Refaeinu',
  'Prosperity': 'Barech Aleinu',
  'Gathering the Exiles': 'Tekah BeShofar',
  'Justice': 'Hashiva Shoftenu',
  'Against Enemies': 'Velamalshinim',
  'The Righteous': 'Al HaTzaddikim',
  'Rebuilding Jerusalem': 'VeLirushalayim',
  'Kingdom of David': 'Es Tzemach David',
  'Response to Prayer': 'Shema Koleinu',
  'Temple Service': 'Retzei',
  'Thanksgiving': 'Modim',
  'Birkat Kohanim': 'Birkas Kohanim',
  'Peace': 'Sim Shalom',
  'Concluding Passage': 'Elokai Netzor',

  // After Amidah / end of davening
  'Post Amidah': 'After Shemoneh Esrei',
  'Vidui and 13 Middot': 'Vidui & 13 Middos',
  'Avinu Malkenu': 'Avinu Malkeinu',
  'Tachanun': 'Tachanun',
  'Torah Reading': 'Krias HaTorah',
  'Concluding Prayers': 'Concluding Prayers',
  'Post Service': 'After the Tefillah',
  'Alenu': 'Aleinu',
  'Song of the Day': 'Shir Shel Yom',
  'Barchi Nafshi': 'Barchi Nafshi',
  'LeDavid': 'LeDavid',
  'Six Remembrances': 'Six Zechiros',
  'Ten Commandments': 'Aseres HaDibros',
  'Thirteen Principles': '13 Ikkarim',
  'Uva Letzion': 'Uva LeTzion',
  'Lamenatze\'ach': 'LaMenatzeach'
};

function niceSiddurName(key) {
  return SIDDUR_NAME_MAP[key] || key;
}

/** Map any path → picker category (Weekday / Shabbos / Yom Tov / Other).
 *  Works across Ashkenaz / Sefard / Edot HaMizrach naming differences. */
function siddurCategory(path) {
  const joined = (Array.isArray(path) ? path : [path]).join(' ').toLowerCase();
  if (/shabbat|shabbos|kabbalat|havdalah|seudah shelish|musaf le/.test(joined)) return 'Shabbos';
  if (/festival|yom tov|holiday|rosh chodesh|sukkot|sukkos|chanukah|selichot|selichos|tal\b|geshem|shalosh regal|fast day/.test(joined)) return 'Yom Tov';
  if (/weekday|shacharit|shacharis|minchah|mincha|maariv|arvit|upon arising|preparatory|bedtime|kiddush levanah|counting of the omer|midnight/.test(joined)) return 'Weekday';
  return 'Other';
}

/** Collect all Hebrew text under a node into one flowing string. */
function collectSiddurText(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node.trim();
  if (Array.isArray(node)) {
    return node.map(collectSiddurText).filter(Boolean).join(' ');
  }
  if (typeof node === 'object') {
    return Object.values(node).map(collectSiddurText).filter(Boolean).join(' ');
  }
  return '';
}

/** Siddur flattener tuned for educators of dyslexic K-12 kids.
 *  Goes deep enough to expose the real teaching units teachers actually
 *  pick and skip:
 *    Modeh Ani, Tzitzis & Tallis, Birchos HaShachar,
 *    Baruch She'amar, Ashrei, each Hallelu-kah, Yishtabach,
 *    each bracha of Shemoneh Esrei, etc.
 *  (depth 4 in the Ashkenaz tree). Still far cleaner than 400+ micro-leaves.
 *  Each chapter carries a category for the grouped picker
 *  (Weekday · Shabbos · Yom Tov · Other). */
function toSiddurChapters(node, path = [], depth = 0) {
  if (node == null) return [];

  // Keep walking while we are still above the teaching-unit level.
  // Depth 0 root → 1 Weekday/Shabbos → 2 Shacharis → 3 Pesukei/Amidah →
  // 4 Baruch She'amar / Avos / etc.  (that is the sweet spot)
  if (typeof node === 'object' && !Array.isArray(node) && depth < 4) {
    return Object.keys(node).flatMap(k =>
      toSiddurChapters(node[k], path.concat(k), depth + 1)
    );
  }

  // This node (or everything under it) becomes one selectable chunk
  const text = collectSiddurText(node);
  if (!text) return [];

  const nicePath = path.map(niceSiddurName);
  // Drop pure container levels from the visible label so the checkbox
  // reads "Shacharis · Pesukei D'Zimra · Baruch She'amar"
  // instead of "Weekday · Shacharis · …"
  const topIsContainer = /^(Weekday|Shabbat|Festivals|Berachot|Kaddish)$/i.test(path[0] || '');
  const label = (topIsContainer && nicePath.length > 1 ? nicePath.slice(1) : nicePath).join(' · ') || 'Prayer';
  const category = siddurCategory(path);
  return [{ label, category, verses: [text] }];
}

const cleanVerse = s => s
  .replace(/<br\s*\/?>/gi, ' ')          // preserve word separation across <br>
  .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, '') // drop footnote markers/text
  // Ketiv/qere: keep qere (reading) and drop ketiv when both are present
  .replace(/<span[^>]*class="[^"]*mam-kq[^"]*"[^>]*>[\s\S]*?<span[^>]*class="[^"]*ketiv[^"]*"[^>]*>[\s\S]*?<\/span>[\s\S]*?<span[^>]*class="[^"]*qere[^"]*"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/span>/gi, '$1')
  .replace(/<span[^>]*class="[^"]*qere[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1')
  .replace(/<span[^>]*class="[^"]*ketiv[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')
  .replace(/<[^>]*>/g, '')
  .replace(/&nbsp;|&thinsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  // Parasha markers: placeholders survive textHTML escaping, then become gap spans
  // {פ} = petucha (open) → four-finger-sized gap; {ס} = setuma (closed) → smaller gap
  .replace(/\{פ\}/g, '§PETUCHA§')
  .replace(/\{ס\}/g, '§SETUMA§')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Split a Rashi / Tosafot comment into dibbur hamatchil + rest.
 * Prefers text before a dash (– — ‒ − -); falls back to a short opening phrase
 * ending in . or : when no dash is present.
 */
function splitDibbur(plain) {
  const s = String(plain || '').trim();
  if (!s) return { dh: '', rest: '' };
  // En-dash / em-dash / figure-dash / minus / ASCII hyphen between spaces
  const dash = s.match(/^([\s\S]{1,100}?)\s*[–—‒−‐‑-]\s+([\s\S]*)$/);
  if (dash && dash[1].trim()) {
    let left = dash[1].trim();
    // If the left side has multiple clauses, the true dibbur is usually the last short one
    const parts = left.split(/(?<=[.:])\s+/).filter(Boolean);
    if (parts.length > 1 && parts[parts.length - 1].length <= 60) {
      left = parts[parts.length - 1];
    }
    return { dh: left, rest: dash[2].trim() };
  }
  // "LEMMA. commentary…" only when the lemma is short
  const dot = s.match(/^(.{2,55}?[.:])\s+([\s\S]{8,})$/);
  if (dot) return { dh: dot[1].trim(), rest: dot[2].trim() };
  return { dh: '', rest: s };
}

/**
 * Format one or more commentary units with bold דיבור המתחיל.
 * For Tosafot, also mark the first word of the dibbur as large (traditional look).
 * Works in stacked (non-Vilna) mode; Vilna uses its own token path.
 */
function commentaryHTML(raw, opts = {}) {
  const pieces = Array.isArray(raw) ? raw.filter(Boolean) : [raw];
  return pieces.map(p => {
    const src = String(p || '');
    // Prefer explicit <b>…</b> as dibbur when present in the source
    const boldMatch = src.match(/^[\s\S]{0,20}?<b[^>]*>([\s\S]+?)<\/b>\s*([\s\S]*)$/i);
    let plain, dh, rest;
    if (boldMatch && boldMatch[1].trim()) {
      dh = cleanVerse(boldMatch[1]);
      rest = cleanVerse(boldMatch[2] || '');
      plain = dh + (rest ? ' ' + rest : '');
    } else {
      plain = cleanVerse(src);
      if (!plain) return '';
      ({ dh, rest } = splitDibbur(plain));
    }
    if (!plain) return '';
    if (!dh) {
      // No clear dibbur — still enlarge first word for Tosafot
      let body = textHTML(plain);
      if (opts.tosafot) {
        body = body.replace(/<span class="w([^"]*)"/, '<span class="w$1 dh-first" style="font-weight:700"');
      }
      return `<div class="comm-unit">${body}</div>`;
    }
    let dhHtml = textHTML(dh);
    // Bold every word of the dibbur (class + inline style so fonts without a bold cut still look heavy)
    dhHtml = dhHtml.replace(/<span class="w([^"]*)"/g, '<span class="w$1 dh" style="font-weight:700"');
    if (opts.tosafot) {
      // First word of the dibbur is larger
      dhHtml = dhHtml.replace(
        /<span class="w([^"]*) dh" style="font-weight:700"/,
        '<span class="w$1 dh dh-first" style="font-weight:700"'
      );
    }
    const restHtml = rest
      ? ` <span class="dh-sep" aria-hidden="true">–</span> ${textHTML(rest)}`
      : '';
    return `<div class="comm-unit"><span class="dh-block" style="font-weight:700">${dhHtml}</span>${restHtml}</div>`;
  }).join('');
}

/** Convert a positive integer to traditional Hebrew gematria (letters). */
function toGimatria(n) {
  n = Math.floor(Number(n));
  if (!isFinite(n) || n <= 0) return String(n);
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];
  let out = '';
  // thousands: use geresh (׳) after the thousands digit letter(s)
  if (n >= 1000) {
    out += toGimatria(Math.floor(n / 1000)) + '׳';
    n %= 1000;
  }
  out += hundreds[Math.floor(n / 100)] || '';
  n %= 100;
  // special forms 15 / 16 (avoid יה / יו)
  if (n === 15) out += 'טו';
  else if (n === 16) out += 'טז';
  else {
    out += tens[Math.floor(n / 10)] || '';
    out += ones[n % 10] || '';
  }
  return out || String(n);
}
const corpusOf = item => {
  const c = ((item.categories && item.categories[0]) || item.section || '').toLowerCase();
  if (/mishn/.test(c)) return 'mishna';
  if (/talmud|gemara|bavli/.test(c)) return 'gemara';
  if (/siddur|liturg|prayer/.test(c)) return 'siddur';
  return 'tanach';
};

if (typeof module !== 'undefined') module.exports = { rootHits, wordHTML, textHTML, toChapters, clusters, clusterKeys, normRoot };

/* ───────── Helpers ───────── */
/** Collapse many calls inside one frame into a single call on the next animation frame. */
function rafOnce(fn) {
  let queued = false;
  return () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; fn(); }); };
}
/** Run low-priority work when the browser is idle (falls back to a short timeout). */
const idle = fn => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 80 }) : setTimeout(fn, 16));
function debounce(fn, ms = 150) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/* ───────── UI state: one settings profile per column ───────── */
const $ = id => document.getElementById(id);
/** Canonical FontFace name for the bundled Dyslex-Kriyah font. */
const DYSLEX_FONT = 'UserFont_Dyslex_Kriyah';
const newProfile = () => ({
  content: 'full', font: DYSLEX_FONT, ls: 0, fs: 12,
  // Default: block highlight at 50% opacity (Otiyot+ extension approach)
  nk: { on: true, mode: 'block', op: 50, keys: Object.fromEntries(NIKUD.map(n => [n.k, { on: true, color: n.c }])) },
  sh: { on: false, mode: 'word', op: 100, color: '#e8b840', root: '' },
  // Trope: whole-word highlight at 50% (marks-only uses the same overlay as niqqud-only)
  tp: { on: false, mode: 'char', op: 50, keys: Object.fromEntries(TROPES.map(t => [t.k, { on: true, color: t.c }])) }
});
const profiles = { R: newProfile(), L: newProfile() };
let side = 'R', tikkun = false;
const P = () => profiles[side];
let library = { tanach: [], mishna: [], gemara: [], siddur: [] }, chapters = [], corpus = 'tanach', rootRows = [], rootOcc = new Map(), fonts = [];
let libraryMode = null;
/** Map of book title → FileSystemFileHandle for Rashi Hebrew (folder-picker / offline mode) */
const rashiHandles = new Map();
let pasukRange = null; // { from:{ch,v}, to:{ch,v} } or null
let showTranslation = false, showRashi = false, showRashiEn = false, showTosafot = false, showPdfBreaks = true, showVilna = false;
/** When true, each pasuk/mishnah is its own block (line break after). When false, verses flow continuously. */
let lineBreakPostPasuk = false;
let siddurSel = new Set();
let rashiChapters = null;      // parallel structure to chapters, or null
let rashiEnChapters = null;    // English Rashi when available
let tosafotChapters = null;    // Tosafot (Gemara) when available
let translationChapters = null; // English verse text when available
/** Approximate printable page height in CSS pixels (Letter, ~0.5" margins). */
const PDF_PAGE_H = 980;


const SAMPLE = ['בָּרוּךְ אַתָּה יְהֹוָה אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם אֲשֶׁר קִדְּשָׁנוּ בְּמִצְוֹתָיו וְצִוָּנוּ עַל נְטִילַת יָדָיִם׃',
  'בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ׃'];

let _renderToken = 0, _pendingFlush = null, _restorePreviewAfterPrint = false;
const _bookJsonCache = new Map();   // url -> parsed JSON (books stay parsed between visits)
const _rashiJsonCache = new Map();  // url -> parsed commentary chapters
const _missingUrls = new Set();     // commentary urls known to 404
const guard = fn => async (...a) => { try { await fn(...a); } catch (e) { if (e.name !== 'AbortError') { console.error(e); alert('Error: ' + e.message); } } };
const setStatus = (id, txt, ok = true) => { const e = $(id); e.textContent = txt; e.classList.toggle('ok', ok); };
let toastTimer;
function toast(msg, kind = '') {
  const t = $('toast'); if (!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (kind ? ' ' + kind : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
const showFolderFallback = () => { /* folder picker removed — library is always ./texts */ };
const mix = (c, op) => `color-mix(in srgb, ${c} ${op}%, transparent)`;
/** Hex + 0–100 opacity → rgba() (Otiyot+ style; more reliable on marks than color-mix alone). */
function hexToRgba(hex, op) {
  const h = String(hex || '').replace('#', '');
  if (h.length < 6) return hex;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${(Math.max(0, Math.min(100, op)) / 100).toFixed(2)})`;
}
const setSeg = (id, m) => [...$(id).children].forEach(x => x.classList.toggle('active', x.dataset.m === m));
const setSwatch = (id, c) => { $(id).dataset.v = c; $(id).style.background = c; };
function seg(id, cb) {
  $(id).onclick = e => { const b = e.target.closest('button'); if (b) { setSeg(id, b.dataset.m); cb(b.dataset.m); } };
}
function panel(strip, pnl, chev) {
  $(strip).onclick = () => { const o = $(pnl).classList.toggle('open'); $(chev).textContent = o ? '▲' : '▼'; };
}

/* ───────── Styles (scoped per column) ───────── */
function sideCSS(id, p) {
  const pre = `#pane-${id} `;
  let css = '';
  // Shared overlay layer metrics (niqqud-only + trope marks-only)
  const obLayer = `display:block!important;grid-area:1/1;` +
    `font-family:var(--hf,'Rubik'),'Arial Hebrew',David,sans-serif!important;` +
    `font-size:inherit;font-weight:inherit;font-style:inherit;line-height:inherit;` +
    `letter-spacing:inherit;font-kerning:none;font-feature-settings:normal;` +
    `font-variant-ligatures:none;font-synthesis:none;text-rendering:geometricPrecision`;
  const inkTop = `color:var(--ink,#1a2f4a);-webkit-text-stroke:.03em var(--ink,#1a2f4a);paint-order:stroke fill;pointer-events:none;-webkit-user-select:none;user-select:none`;

  if (p.nk.on && p.content === 'full') NIKUD.forEach(n => {
    const k = p.nk.keys[n.k]; if (!k.on) return;
    const rgba = hexToRgba(k.color, p.nk.op);
    if (p.nk.mode === 'block') {
      // Block: tinted background on the whole letter (Otiyot+ default)
      css += `${pre}.c.k-${n.k}{background-color:${rgba}}`;
      css += `${pre}.c.k-${n.k}.ob{display:inline}`;
      css += `${pre}.c.k-${n.k}.ob>.top{display:none!important}`;
      css += `${pre}.c.k-${n.k}.ob>.nk-full{display:inline;color:inherit;background:transparent}`;
    } else {
      // Niqqud only: colour bottom layer; show top-nv (no vowels) in ink
      css += `${pre}.c.k-${n.k}.ob{display:inline-grid;justify-items:start;white-space:nowrap;background:transparent}`;
      css += `${pre}.c.k-${n.k}.ob>.nk-full,${pre}.c.k-${n.k}.ob>.top-nv{${obLayer}}`;
      css += `${pre}.c.k-${n.k}.ob>.top-nt{display:none!important}`;
      css += `${pre}.c.k-${n.k}.ob>.nk-full{color:${rgba}}`;
      css += `${pre}.c.k-${n.k}.ob>.top-nv{${inkTop}}`;
      css += `${pre}.c.k-${n.k}:not(.ob){color:${rgba}}`;
      css += `${pre}.c.k-${n.k}.ob-bad{display:inline}`;
      css += `${pre}.c.k-${n.k}.ob-bad>.top{display:none!important}`;
      css += `${pre}.c.k-${n.k}.ob-bad>.nk-full{display:inline;color:${rgba}}`;
    }
  });
  if (p.sh.on && p.sh.root) {
    const c = mix(p.sh.color, p.sh.op);
    css += p.sh.mode === 'bar' ? `${pre}.c.sh{background-image:linear-gradient(to top,${c} .16em,transparent .16em)}`
      : p.sh.mode === 'char' ? `${pre}.c.sh{color:${c};font-weight:600}` : `${pre}.w.rm{background-color:${c};border-radius:4px}`;
  }
  if (p.tp.on && p.content === 'full') {
    TROPES.forEach(t => {
      const k = p.tp.keys[t.k]; if (!k || !k.on) return;
      const rgba = hexToRgba(k.color, p.tp.op);
      if (p.tp.mode === 'mark') {
        // Marks only: same overlay as niqqud-only, but top-nt hides tropes
        css += `${pre}.c.tp-${t.k}.ob{display:inline-grid;justify-items:start;white-space:nowrap;background:transparent}`;
        css += `${pre}.c.tp-${t.k}.ob>.nk-full,${pre}.c.tp-${t.k}.ob>.top-nt{${obLayer}}`;
        css += `${pre}.c.tp-${t.k}.ob>.top-nv{display:none!important}`;
        css += `${pre}.c.tp-${t.k}.ob>.nk-full{color:${rgba}}`;
        css += `${pre}.c.tp-${t.k}.ob>.top-nt{${inkTop}}`;
        // Clusters with a trope but no overlay wrapper
        css += `${pre}.c.tp-${t.k}:not(.ob){color:${rgba}}`;
        css += `${pre}.c.tp-${t.k}.ob-bad{display:inline}`;
        css += `${pre}.c.tp-${t.k}.ob-bad>.top{display:none!important}`;
        css += `${pre}.c.tp-${t.k}.ob-bad>.nk-full{display:inline;color:${rgba}}`;
      } else {
        // Whole word
        css += `${pre}.w.tp-${t.k}{background-color:${rgba};border-radius:4px}`;
      }
    });
  }
  return css;
}
const applyStylesSoon = rafOnce(() => applyStyles());
function applyStyles() {
  $('dyn').textContent = sideCSS('R', profiles.R) + (tikkun ? sideCSS('L', profiles.L) : '');
  ['R', 'L'].forEach(id => {
    const pane = $('pane-' + id), p = profiles[id]; if (!pane) return;
    pane.style.setProperty('--fs', p.fs + 'pt'); pane.style.setProperty('--ls', p.ls + 'px'); pane.style.setProperty('--hf', p.font);
  });
  const p = P();
  [...$('nk-dots').children].forEach((d, i) => { const k = p.nk.keys[NIKUD[i].k]; d.style.background = k.color; d.classList.toggle('off', !k.on || !p.nk.on); });
  $('sh-dot').style.background = p.sh.color; $('sh-dot').classList.toggle('off', !p.sh.on);
  const tpDots = $('tp-dots');
  if (tpDots) [...tpDots.children].forEach((d, i) => {
    const k = p.tp.keys[TROPES[i].k];
    d.style.background = k ? k.color : '#ccc';
    d.classList.toggle('off', !k || !k.on || !p.tp.on);
  });
  // After CSS is applied, check overlay alignment (font-dependent) on next frame
  requestAnimationFrame(verifyOverlays);
}

/**
 * Otiyot+ overlay safety net: some fonts swap glyphs when marks attach (or lack
 * niqqud entirely, so the mark falls back to another face). If the two layers
 * don't line up, mark the cluster .ob-bad so CSS hides the top layer and the
 * whole letter takes the highlight colour — no fringe, no guessing.
 * Non-destructive (class only) so switching fonts/modes can recover.
 */
function verifyOverlays() {
  const v = $('text-viewer');
  if (!v) return;
  const obs = v.querySelectorAll('.c.ob');
  for (const ob of obs) {
    const pane = ob.closest('.pane');
    const id = pane && pane.id === 'pane-L' ? 'L' : 'R';
    const p = profiles[id];
    // Active mark-only overlay: niqqud-only uses .top-nv, trope marks-only uses .top-nt
    const nkChar = p && p.nk.on && p.nk.mode === 'char' && p.content === 'full';
    const tpMark = p && p.tp.on && p.tp.mode === 'mark' && p.content === 'full';
    if (!nkChar && !tpMark) {
      ob.classList.remove('ob-bad');
      continue;
    }
    const nk = ob.querySelector(':scope > .nk-full');
    const top = ob.querySelector(nkChar ? ':scope > .top-nv' : ':scope > .top-nt');
    if (!nk || !top) continue;
    const prev = top.style.display;
    top.style.display = 'block';
    const a = nk.getBoundingClientRect();
    const b = top.getBoundingClientRect();
    top.style.display = prev;
    const bad = Math.abs(a.width - b.width) > 0.6 ||
                Math.abs(a.left - b.left) > 0.6 ||
                Math.abs(a.top - b.top) > 0.6;
    ob.classList.toggle('ob-bad', bad);
  }
}

/* ───────── Reading area ───────── */

/* ───────── Tanach pasuk range + Rashi / Translation ───────── */
function parseRef(s) {
  // "1:14" or "1" → { ch, v }  (1-based). Bare chapter → verse 1.
  const m = String(s).trim().match(/^(\d+)(?::(\d+))?$/);
  if (!m) return null;
  return { ch: +m[1], v: m[2] ? +m[2] : 1 };
}
function parseRange(str) {
  // Legacy single-string form: "1:14-6:20" or "1:14 – 6:20" or "3:5-3:10" inclusive
  if (!str || !String(str).trim()) return null;
  const parts = String(str).split(/\s*[-–—]\s*/);
  if (parts.length === 1) {
    const a = parseRef(parts[0]);
    if (!a) return null;
    // single chapter means whole chapter if no verse, else one verse
    const bare = !String(parts[0]).includes(':');
    return { from: a, to: bare ? { ch: a.ch, v: 9999 } : a };
  }
  if (parts.length !== 2) return null;
  const from = parseRef(parts[0]), to = parseRef(parts[1]);
  if (!from || !to) return null;
  // "6" as end means end of chapter 6
  if (!String(parts[1]).includes(':')) to.v = 9999;
  return { from, to };
}

/** Build range from the two separate From / To boxes. */
function parseRangeFromBoxes() {
  const fromEl = $('range-from'), toEl = $('range-to');
  if (!fromEl && !toEl) {
    const legacy = $('pasuk-range');
    return legacy && legacy.value.trim() ? parseRange(legacy.value) : null;
  }
  const fromRaw = (fromEl && fromEl.value || '').trim();
  const toRaw = (toEl && toEl.value || '').trim();
  if (!fromRaw && !toRaw) return null;

  // Gemara: 2a / 5b
  if (corpus === 'gemara') {
    const parseDaf = s => {
      const m = String(s).trim().match(/^(\d+)([ab])?$/i);
      if (!m) return null;
      return { ch: +m[1], v: (m[2] || 'a').toLowerCase() === 'b' ? 1 : 0, label: m[1] + ((m[2] || 'a').toLowerCase()) };
    };
    const from = parseDaf(fromRaw || '2a');
    const to = parseDaf(toRaw || fromRaw || '2a');
    if (!from || !to) return null;
    return { from, to, fromLabel: from.label, toLabel: to.label };
  }

  // Mishnah: chapter numbers
  if (corpus === 'mishna') {
    const a = parseInt(fromRaw, 10);
    const b = parseInt(toRaw || fromRaw, 10);
    if (!a || !b) return null;
    return { from: { ch: a, v: 1 }, to: { ch: b, v: 9999 } };
  }

  const from = parseRef(fromRaw || '1:1');
  if (!from) return null;
  let to;
  if (!toRaw) {
    to = { ch: from.ch, v: 9999 };
  } else {
    to = parseRef(toRaw);
    if (!to) return null;
    if (!toRaw.includes(':') && to.v === 1) to.v = 9999;
  }
  return { from, to };
}
function refInRange(ch, v, range) {
  if (!range) return true;
  const a = range.from, b = range.to;
  if (ch < a.ch || ch > b.ch) return false;
  if (ch === a.ch && v < a.v) return false;
  if (ch === b.ch && v > b.v) return false;
  return true;
}
function filterChaptersByRange(chaps, range) {
  if (!range || !chaps) return chaps;
  const out = [];
  chaps.forEach((c, ci) => {
    // label may be "1", "2", or already "2a"
    const chNum = parseInt(c.label, 10) || (ci + 1);
    const verses = [];
    const nums = [];
    (c.verses || []).forEach((t, vi) => {
      const vNum = vi + 1;
      if (refInRange(chNum, vNum, range)) { verses.push(t); nums.push(vNum); }
    });
    if (verses.length) out.push({ label: c.label, verses, verseNums: nums, chNum });
  });
  return out;
}

function toRashiChapters(root) {
  const arr = Array.isArray(root) ? root : [];
  return arr.map((ch, i) => {
    // Keep each comment as its own string so commentaryHTML can bold each dibbur.
    // (Previously joined with spaces, which merged multiple דיבורים into one blob.)
    const verses = (Array.isArray(ch) ? ch : (ch ? [ch] : [])).map(v => {
      if (Array.isArray(v)) return v.map(x => String(x || '')).filter(Boolean);
      return v == null ? '' : String(v);
    });
    return { label: String(i + 1), verses };
  });
}

/** Remap commentary chapters to match current chapter labels by order (Gemara daf, etc.).
 *  Do NOT filter empty commentary — an amud with no Tosafot must keep its slot so later
 *  amudim stay aligned. Zip by the same array index as the primary text. */
function alignCommentaryLabels(commentary) {
  if (!commentary || !chapters.length) return commentary;
  // If labels already match, keep as-is
  const labels = new Set(chapters.map(c => String(c.label)));
  if (commentary.some(c => labels.has(String(c.label)))) return commentary;
  // Zip by index without dropping empty slots
  return chapters.map((ch, i) => ({
    label: ch.label,
    verses: (commentary[i] && commentary[i].verses) || []
  }));
}

async function fetchRashiJson(url) {
  if (_rashiJsonCache.has(url)) return _rashiJsonCache.get(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  const root = j.text ?? (j.versions && j.versions[0] && j.versions[0].text) ?? j.he ?? j;
  const chaps = toRashiChapters(root);
  if (!chaps.length) throw new Error('empty rashi');
  _rashiJsonCache.set(url, chaps);
  return chaps;
}

async function loadSideText(bookTitle, kind, origTitle, preUrl, rashiHandle) {
  // kind: 'rashi-he' | 'rashi-en' | 'tosafot-he'
  // Works offline: prefer FileSystemFileHandle (folder picker), then fetch (http server)

  // 1) Offline handle (file:// + folder picker, or remembered directory)
  const handle = rashiHandle
    || (kind === 'rashi-en'
        ? (rashiHandles.get(bookTitle + '::en') || rashiHandles.get((bookTitle || '').toLowerCase() + '::en'))
        : kind === 'tosafot-he'
          ? (rashiHandles.get(bookTitle + '::tos') || rashiHandles.get((bookTitle || '').toLowerCase() + '::tos'))
          : (rashiHandles.get(bookTitle) || rashiHandles.get((bookTitle || '').toLowerCase())));
  if (handle && handle.getFile) {
    try {
      const text = await (await handle.getFile()).text();
      const j = JSON.parse(text);
      const root = j.text ?? (j.versions && j.versions[0] && j.versions[0].text) ?? j.he ?? j;
      const chaps = toRashiChapters(root);
      if (chaps.length) {
        console.log('Rashi loaded from file handle ·', chaps.length, 'chapters');
        return chaps;
      }
    } catch (e) {
      console.warn('Rashi handle read failed', e);
    }
  }

  // 2) Fetch over http(s)
  const folder = '05_Commentaries';
  const lang = kind === 'rashi-en' ? 'English' : 'Hebrew';
  const base = (bookTitle || '').trim();
  const orig = (origTitle || '').replace(/\.json$/i, '').replace(/\s+Hebrew$/i, '').trim();

  const urls = [];
  const add = u => { if (u && !urls.includes(u)) urls.push(u); };
  if (preUrl) add(preUrl);

  const names = [];
  const push = n => { if (n && !names.includes(n)) names.push(n); };
  const isTos = kind === 'tosafot-he';
  [base, orig].filter(Boolean).forEach(t => {
    if (isTos) {
      push(`${t} Tosafot Hebrew.json`);
      push(`${t} Tosafot ${lang}.json`);
    } else {
      push(`${t} Rashi ${lang}.json`);
      push(`${t} Rashi ${lang.toLowerCase()}.json`);
      push(`Rashi on ${t} ${lang}.json`);
    }
  });
  const alt = base
    .replace(/^I\s+/, '1 ').replace(/^II\s+/, '2 ').replace(/^III\s+/, '3 ')
    .replace(/^1\s+/, 'I ').replace(/^2\s+/, 'II ').replace(/^3\s+/, 'III ');
  if (alt && alt !== base) push(`${alt} Rashi ${lang}.json`);

  names.forEach(name => {
    add(`./texts/${folder}/${encodeURIComponent(name)}`);
    add(`texts/${folder}/${encodeURIComponent(name)}`);
  });

  let lastErr = null;
  for (const url of urls) {
    if (_missingUrls.has(url)) continue;
    try {
      const chaps = await fetchRashiJson(url);
      console.log('Rashi loaded from', url, '·', chaps.length, 'chapters');
      return chaps;
    } catch (e) {
      lastErr = e;
      _missingUrls.add(url);
    }
  }
  console.warn('No Rashi found for', bookTitle, 'last error:', lastErr && lastErr.message);
  return null;
}

const trCache = new Map();
/** Map our clean book title → Sefaria API path for English. */
function sefariaRef(bookTitle, label, idx) {
  let t = (bookTitle || '').trim();
  // Sefaria uses plain Pirkei_Avot (not Mishnah_Pirkei_Avot) and Taanit (not Ta'anit)
  if (corpus === 'mishna') {
    if (/^Pirkei\s*Avot$/i.test(t) || /^Avot$/i.test(t)) t = 'Pirkei_Avot';
    else if (/^Ta['']?anit$/i.test(t)) t = 'Taanit';
    else t = 'Mishnah_' + t.replace(/\s+/g, '_');
    const ch = label || String(idx + 1);
    return `${t}.${ch}`;
  }
  if (corpus === 'gemara') {
    // label is already "2a" / "3b"
    const daf = label || String(idx + 1);
    return `${t.replace(/\s+/g, '_')}.${daf}`;
  }
  // Tanach
  const ch = parseInt(label, 10) || (idx + 1);
  return `${t}.${ch}`;
}
async function loadEnglishTranslation(bookTitle, chaps) {
  try {
    const out = new Array(chaps.length);
    let next = 0;
    let failed = 0;
    // At most 4 Sefaria requests in flight, instead of one per chapter all at once.
    const worker = async () => {
      while (next < chaps.length) {
        const i = next++, c = chaps[i];
        const ref = sefariaRef(bookTitle, c.label, i);
        const key = corpus + ':' + ref;
        if (!trCache.has(key)) {
          const api = `https://www.sefaria.org/api/texts/${encodeURIComponent(ref)}?context=0`;
          const res = await fetch(api);
          if (!res.ok) {
            trCache.set(key, []);
            failed++;
          } else {
            const data = await res.json();
            const eng = data.text || data.en || [];
            trCache.set(key, Array.isArray(eng) ? eng.map(v => (Array.isArray(v) ? v.join(' ') : String(v))) : []);
          }
        }
        out[i] = { label: c.label, verses: trCache.get(key) };
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, chaps.length) }, worker));
    if (failed > 0 && failed === chaps.length) {
      toast('Translation unavailable for this book (Sefaria)', 'warn');
    }
    return out;
  } catch (e) {
    console.warn('English translation unavailable (offline?)', e);
    toast('Translation needs internet (Sefaria)', 'warn');
    return null;
  }
}

/** Fetch English only for the chapters currently on screen (and only the ones not loaded yet).
 *  Returns true when something new was loaded. */
async function ensureTranslation() {
  if (!showTranslation) return false;
  const titleSel = $('select-title');
  const item = (library[corpus] || [])[titleSel && titleSel.value !== '' ? +titleSel.value : -1];
  if (!item) return false;
  if (!translationChapters) translationChapters = [];
  const arr = translationChapters;
  const have = new Set(arr.map(x => x.label));
  const need = getSource().filter(c => c.label && !have.has(c.label));
  if (!need.length) return false;
  const got = await loadEnglishTranslation(item.title, need.map(c => ({ label: c.label })));
  if (translationChapters !== arr) return false; // book / tab changed while we waited
  if (!got) { toast('Translation needs internet (Sefaria)', 'warn'); return false; }
  got.forEach(g => arr.push(g));
  return true;
}

/** Lock / unlock a control for the current tab. Locked = grayed out + disabled (not clickable). */
function setToolAvail(el, on, why = '') {
  if (!el) return;
  el.hidden = false; // keep in layout so the bar doesn't jump
  el.classList.toggle('unavailable', !on);
  el.title = on ? '' : (why || 'Not available on this tab');
  if (el.tagName === 'LABEL' || el.classList.contains('chk')) {
    el.dataset.why = on ? '' : (why || 'Not available on this tab');
    const input = el.querySelector('input');
    if (input) {
      input.disabled = !on;
      // Turn the option off when it doesn't apply, so state doesn't leak across tabs
      if (!on && input.type === 'checkbox' && input.checked) {
        input.checked = false;
        if (input.id === 'opt-translation') showTranslation = false;
        if (input.id === 'opt-rashi') { showRashi = false; showRashiEn = false; }
        if (input.id === 'opt-rashi-en') showRashiEn = false;
        if (input.id === 'opt-tosafot') showTosafot = false;
        if (input.id === 'opt-vilna') showVilna = false;
        if (input.id === 'opt-line-break') lineBreakPostPasuk = false;
      }
    }
  }
  if (el.id === 'range-tools') {
    // From / To / Go follow the lock; Clear always stays clickable so Siddur
    // (and any locked corpus) can still wipe the page.
    el.querySelectorAll('input, button').forEach(n => {
      if (n.id === 'btn-range-clear') {
        n.disabled = false;
        n.removeAttribute('disabled');
        return;
      }
      n.disabled = !on;
      if (on) n.removeAttribute('disabled');
    });
    if (!on) {
      el.querySelectorAll('input[type="text"]').forEach(n => { n.value = ''; });
      pasukRange = null;
    }
  }
}

function updateTanachToolsVisibility() {
  const el = $('corpus-tools') || $('tanach-tools');
  if (!el) return;
  el.hidden = false;

  const isTanach = corpus === 'tanach';
  const isMishna = corpus === 'mishna';
  const isGemara = corpus === 'gemara';
  const isText = isTanach || isMishna || isGemara;
  const isSiddur = corpus === 'siddur';

  // Placeholders by corpus
  const from = $('range-from'), to = $('range-to');
  if (from && to) {
    if (isGemara) {
      from.placeholder = '2a'; to.placeholder = '5b';
      from.title = 'Starting daf (e.g. 2a)'; to.title = 'Ending daf (e.g. 5b)';
    } else if (isMishna) {
      from.placeholder = '1'; to.placeholder = '5';
      from.title = 'Starting chapter'; to.title = 'Ending chapter';
    } else {
      from.placeholder = '1:1'; to.placeholder = '6:20';
      from.title = 'Starting chapter:verse'; to.title = 'Ending chapter:verse';
    }
  }

  // Per-book: some masechtot (Tamid, etc.) have no Rashi/Tosafot in the catalog
  const titleSel = $('select-title');
  const item = (library[corpus] || [])[titleSel && titleSel.value !== '' ? +titleSel.value : -1];
  const bookTitle = item ? item.title : '';
  const noRashiBooks = /^(Tamid|Middot|Kinnim)$/i;
  const hasRashi = (isTanach || isGemara) && !noRashiBooks.test(bookTitle);
  const hasTosafot = isGemara && !noRashiBooks.test(bookTitle);

  // Lock controls that don't apply to the current tab (grayed out + disabled)
  setToolAvail($('range-tools'), isText, 'Range is for Tanach / Mishna / Gemara');
  setToolAvail($('lab-translation') || ($('opt-translation') && $('opt-translation').closest('label')), isText && !showVilna, isSiddur ? 'Not on Siddur' : 'Not available here');
  setToolAvail($('lab-rashi'), hasRashi && !showVilna, isMishna ? 'No Rashi on Mishnah' : (noRashiBooks.test(bookTitle) ? 'No Rashi for this masechta' : 'Not available here'));
  setToolAvail($('lab-rashi-en'), isTanach && !showVilna, 'Rashi EN is only for Tanach');
  setToolAvail($('lab-tosafot'), hasTosafot && !showVilna, noRashiBooks.test(bookTitle) ? 'No Tosafot for this masechta' : 'Tosafot is only for Gemara');
  setToolAvail($('lab-vilna'), isGemara, 'Vilna layout is only for Gemara');
  setToolAvail($('lab-pdf-breaks') || ($('opt-pdf-breaks') && $('opt-pdf-breaks').closest('label')), true);
  setToolAvail($('lab-line-break') || ($('opt-line-break') && $('opt-line-break').closest('label')), isText || isSiddur, 'Not available on this tab');

  // Label for the line-break toggle — match the unit of the current tab
  const labBreak = $('lab-line-break');
  if (labBreak) {
    const unit =
      isGemara ? 'segment' :
      isMishna ? 'mishnah' :
      isSiddur ? 'paragraph' :
      'pasuk';
    const input = labBreak.querySelector('input');
    // rebuild label text while keeping the checkbox
    labBreak.innerHTML = '';
    if (input) labBreak.appendChild(input);
    labBreak.appendChild(document.createTextNode(` Line break after ${unit}`));
    labBreak.title = `When on, each ${unit} starts on a new line. When off, text flows continuously.`;
  }

  // Sidebar: nikud / shoresh stay available for all text corpora (including Gemara Vilna);
  // trope only makes sense on Tanach.
  const tropeRow = $('row-trope');
  const tropeNote = $('trope-avail-note');
  if (tropeRow) tropeRow.classList.toggle('dimmed', !isTanach);
  if (tropeNote) tropeNote.hidden = isTanach;
  const niqqudRow = $('row-niqqud');
  const shoreshRow = $('row-shoresh');
  if (niqqudRow) niqqudRow.classList.remove('dimmed');
  if (shoreshRow) shoreshRow.classList.remove('dimmed');
}


function dafSortKey(label) {
  const m = String(label || '').trim().match(/^(\d+)([ab])?$/i);
  if (!m) return 1e9;
  const n = parseInt(m[1], 10);
  const side = (m[2] || 'a').toLowerCase() === 'b' ? 1 : 0;
  return n * 2 + side;
}

function filterByCorpusRange(chaps, range) {
  if (!range || !chaps) return chaps;
  if (corpus === 'gemara') {
    // from/to stored as { ch: dafNumber, v: 0=a 1=b } or we encode daf in a custom way
    const a = dafSortKey(range.fromLabel || (range.from.ch + (range.from.v ? 'b' : 'a')));
    const b = dafSortKey(range.toLabel || (range.to.ch + (range.to.v ? 'b' : 'a')));
    return chaps.filter(c => {
      const k = dafSortKey(c.label);
      return k >= a && k <= b;
    });
  }
  if (corpus === 'mishna') {
    const a = range.from.ch, b = range.to.ch;
    return chaps.filter((c, ci) => {
      const n = parseInt(c.label, 10) || (ci + 1);
      return n >= a && n <= b;
    });
  }
  return filterChaptersByRange(chaps, range);
}

/** Return a human-readable error if the requested range has no matching text in the current book, else null. */
function rangeBoundsError(range, chaps) {
  if (!range || !chaps || !chaps.length) return null;
  const filtered = filterByCorpusRange(chaps, range);
  const n = filtered.reduce((s, c) => s + (c.verses ? c.verses.length : 0), 0);
  if (n > 0) return null;

  const fmt = (r) => {
    if (corpus === 'gemara') return range.fromLabel || (r.ch + (r.v ? 'b' : 'a'));
    if (corpus === 'mishna') return String(r.ch);
    return r.v >= 9999 ? String(r.ch) : `${r.ch}:${r.v}`;
  };
  const left = fmt(range.from);
  const right = fmt(range.to);
  const maxCh = chaps.length;
  // More specific messages when we can detect the problem
  if (corpus === 'tanach' || corpus === 'mishna') {
    const maxV = (ch) => {
      const c = chaps.find((x, i) => (parseInt(x.label, 10) || (i + 1)) === ch);
      return c && c.verses ? c.verses.length : 0;
    };
    if (range.from.ch > maxCh || range.to.ch > maxCh) {
      return `Range ${left}–${right} is outside this book (only ${maxCh} chapter${maxCh === 1 ? '' : 's'})`;
    }
    if (range.from.ch === range.to.ch) {
      const mv = maxV(range.from.ch);
      if (range.from.v > mv || (range.to.v < 9999 && range.to.v > mv)) {
        return `Chapter ${range.from.ch} only has ${mv} verse${mv === 1 ? '' : 's'} — ${left}–${right} not found`;
      }
    }
  }
  if (corpus === 'gemara') {
    return `Daf range ${left}–${right} not found in this masechta`;
  }
  return `Range ${left}–${right} not found in this book`;
}

/** Chapters in the current selection (full book, or pasuk/daf range). */
function getVisibleChapters() {
  if (!chapters.length) return [];
  if (pasukRange && (corpus === 'tanach' || corpus === 'mishna' || corpus === 'gemara')) {
    return filterByCorpusRange(chapters, pasukRange);
  }
  return chapters;
}

/** Classic source list — full selection in the DOM (or one chapter from the dropdown). */
function getSource() {
  if (!chapters.length) return [{ label: '', verses: SAMPLE, num: false, verseNums: null }];
  if (corpus === 'siddur') {
    // Siddur sections are not numbered verses — suppress the "1" badge
    return chapters.filter((c, i) => siddurSel.has(i)).map(c => ({ ...c, num: false }));
  }
  let src = getVisibleChapters();
  const sel = $('select-chapter') ? $('select-chapter').value : 'all';
  // Range or "Whole selection" → everything; otherwise the chosen chapter only
  if (pasukRange || !sel || sel === 'all') {
    return src.map(c => ({ ...c, num: true }));
  }
  const i = parseInt(sel, 10);
  if (Number.isFinite(i) && src[i]) return [{ ...src[i], num: true }];
  return src.map(c => ({ ...c, num: true }));
}
function applyRoot(id, scope) {
  const pane = $('pane-' + id); if (!pane) return 0;
  // Full pass clears old highlights; a scoped pass (new chunk) only touches the new nodes.
  if (!scope) {
    pane.querySelectorAll('.sh').forEach(e => e.classList.remove('sh'));
    pane.querySelectorAll('.rm').forEach(e => e.classList.remove('rm'));
  }
  const t = normRoot(stripMarks(profiles[id].sh.root).replace(/\s/g, ''));
  let n = 0;
  if (t.length >= 2) {
    const words = scope ? scope.flatMap(e => [...e.querySelectorAll('.w')]) : pane.querySelectorAll('.w');
    // Always process every word so counts + highlights stay correct after scroll.
    // (Previously culled to ~viewport when >8000 words; that under-counted and
    // dropped matches when the user scrolled.)
    words.forEach(w => {
      const idx = rootHits(w.dataset.c, t);
      if (idx) {
        n++;
        w.classList.add('rm');
        for (const i of idx) if (w.children[i]) w.children[i].classList.add('sh');
      }
    });
  }
  return n;
}
function applyRoots() {
  // Always refresh highlights for every visible pane so tikkun columns stay independent
  const ids = tikkun ? ['R', 'L'] : ['R'];
  ids.forEach(applyRoot);
}
function updateCount() {
  const t = normRoot(stripMarks(P().sh.root).replace(/\s/g, '')), el = $('sh-count');
  // Always re-apply so clearing the root (or typing <2 letters) removes old highlights.
  // Both columns are refreshed so each keeps its own independent root highlight in tikkun mode.
  applyRoots();
  el.classList.remove('note-warn');
  if (t.length < 2) {
    el.textContent = 'Type 2–5 root letters to highlight them in the text.';
    return;
  }
  // Count matches in the active column only (the one whose settings are showing)
  const pane = $('pane-' + side);
  const n = pane ? pane.querySelectorAll('.w.rm').length : 0;
  if (rootRows.length && !rootOcc.has(t)) {
    el.classList.add('note-warn');
    el.textContent = `No shoresh “${t}” in the Tanakh root list` + (n ? ` · ${n} possible match${n === 1 ? '' : 'es'} in this view` : '');
    return;
  }
  el.textContent = `${n} word${n === 1 ? '' : 's'} in this view` + (rootOcc.has(t) ? ` · ${rootOcc.get(t)} in Tanakh (CSV)` : '');
}

/** Google-style shoresh suggestions from the root CSV. */
function closeShSuggest() {
  const box = $('sh-suggest'), inp = $('sh-root');
  if (box) { box.hidden = true; box.innerHTML = ''; }
  if (inp) inp.setAttribute('aria-expanded', 'false');
}
function renderShSuggest(q) {
  const box = $('sh-suggest'), inp = $('sh-root');
  if (!box || !inp) return;
  const t = normRoot(stripMarks(q).replace(/\s/g, ''));
  if (t.length < 1) { closeShSuggest(); return; }
  if (!rootRows.length) {
    box.innerHTML = `<div class="sh-suggest-empty">Root list not loaded yet</div>`;
    box.hidden = false;
    inp.setAttribute('aria-expanded', 'true');
    return;
  }
  // Prefer prefix matches, then contains; exact first
  const scored = [];
  for (const r of rootRows) {
    if (r.root === t) scored.push({ r, s: 0 });
    else if (r.root.startsWith(t)) scored.push({ r, s: 1 });
    else if (r.root.includes(t)) scored.push({ r, s: 2 });
  }
  scored.sort((a, b) => a.s - b.s || (+b.r.occ || 0) - (+a.r.occ || 0));
  const top = scored.slice(0, 12);
  if (!top.length) {
    box.innerHTML = `<div class="sh-suggest-empty">No shoresh matching “${esc(t)}”</div>`;
    box.hidden = false;
    inp.setAttribute('aria-expanded', 'true');
    return;
  }
  box.innerHTML = top.map(({ r }, i) =>
    `<div class="sh-suggest-item${i === 0 ? ' active' : ''}" role="option" data-r="${esc(r.root)}" tabindex="-1">` +
    `<span class="root">${esc(r.root)}</span>` +
    `<span class="occ">${esc(String(r.occ || ''))}× in Tanakh</span>` +
    `</div>`
  ).join('');
  box.hidden = false;
  inp.setAttribute('aria-expanded', 'true');
}
function pickShSuggest(root) {
  const inp = $('sh-root');
  if (!inp) return;
  inp.value = root;
  const p = P();
  p.sh.root = root;
  if (!p.sh.on) setHighlight('sh', true);
  closeShSuggest();
  updateCount();
  applyStyles();
}


/** Vilna/Sefaria: build daf labels 2a,2b,… from amud count (Sefaria length). */
function dafLabelsFromLength(n) {
  const labels = [];
  const N = Math.max(0, parseInt(n, 10) || 0);
  for (let i = 0; i < N; i++) {
    const num = Math.floor(i / 2) + 2;
    labels.push(num + (i % 2 ? 'b' : 'a'));
  }
  return labels;
}

async function loadGemaraDafListFromSefaria(bookTitle) {
  const url = 'https://www.sefaria.org/api/texts/' + encodeURIComponent(bookTitle) + '?commentary=0&context=0';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Sefaria index ' + res.status);
  const data = await res.json();
  const len = data.length || (Array.isArray(data.he) ? data.he.length : 0) || (Array.isArray(data.text) ? data.text.length : 0);
  if (!len) throw new Error('No daf length for ' + bookTitle);
  return dafLabelsFromLength(len);
}

async function renderVilnaGemara() {
  const v = $('text-viewer');
  if (!v) return;
  if (typeof VilnaGemara === 'undefined') {
    toast('Vilna engine not loaded', 'warn');
    return;
  }
  const titleSel = $('select-title');
  const item = (library[corpus] || [])[titleSel && titleSel.value !== '' ? +titleSel.value : -1];
  const bookTitle = item ? item.title : null;
  if (!bookTitle) {
    v.innerHTML = `<div class="empty-state"><div class="empty-title">Choose a masechta</div></div>`;
    return;
  }
  // Vilna stays one amud at a time (measured layout is heavy); chapter menu picks which
  const visible = getVisibleChapters();
  const chapSel = $('select-chapter');
  let idx = chapSel ? parseInt(chapSel.value, 10) : 0;
  if (!Number.isFinite(idx) || idx < 0 || idx >= visible.length) idx = 0;
  const labels = visible[idx] && visible[idx].label ? [visible[idx].label] : [];
  if (!labels.length) {
    v.innerHTML = `<div class="empty-state"><div class="empty-title">Pick a daf</div><div class="empty-sub">Select a daf or set a range like 2a–3b.</div></div>`;
    return;
  }
  const use = labels;
  v.innerHTML = `<div class="empty-state"><div class="empty-title">Loading Vilna layout…</div><div class="empty-sub">${use.map(esc).join(' · ')}</div></div>`;
  // Prefer local Otiyot fonts; fall back to the engine defaults.
  // Char budgets INCLUDE spaces (medium targets).
  // Tuned: Rashi +4; Gemara −6 total from prior pass (−2 then −4).
  const vilnaOpts = {
    ignorePunct: true,
    chars: {
      gemara:  { short: 25, normal: 37, wide: 49 },
      comment: { short: 24, normal: 32, wide: 46 },
    },
    fonts: {
      gemara:  { family: '"VilnaSquare","Frank Ruehl Libre","Noto Serif Hebrew","Times New Roman",serif', size: 20, lineHeight: 28, weight: 400, boldWeight: 700, bigScale: 1.3 },
      comment: { family: '"VilnaRashi","Noto Rashi Hebrew","Frank Ruehl Libre","Times New Roman",serif', size: 15, lineHeight: 19, weight: 400, boldWeight: 700, bigScale: 1.35 },
    },
  };
  try {
    const html = await VilnaGemara.buildVilnaRange(bookTitle, use, vilnaOpts);
    v.innerHTML = html;
    v.classList.remove('has-rashi', 'tikkun');
    v.classList.add('vilna-mode');
    // Scale each daf to the viewer width (design width stays constant for measurement).
    if (typeof VilnaGemara.fitToWidth === 'function') {
      v.querySelectorAll('.vilna-daf').forEach(VilnaGemara.fitToWidth);
    }
    // Retry buttons (if any legacy error cards still emit them)
    v.querySelectorAll('.vilna-retry').forEach(btn => {
      btn.onclick = async () => {
        const ref = btn.dataset.ref;
        btn.disabled = true;
        btn.textContent = 'Loading…';
        try {
          const daf = await VilnaGemara.buildVilnaDaf(ref, vilnaOpts);
          const err = btn.closest('.vilna-error');
          if (err) {
            err.outerHTML = daf.html;
            const newDaf = v.querySelector(`.vilna-daf[data-ref="${ref}"]`);
            if (newDaf && typeof VilnaGemara.fitToWidth === 'function') VilnaGemara.fitToWidth(newDaf);
          }
        } catch (e) {
          btn.disabled = false;
          btn.textContent = 'Retry';
          toast(e.message || 'Retry failed', 'warn');
        }
      };
    });
    if (showPdfBreaks) requestAnimationFrame(() => markPdfPageBreaks());
  } catch (e) {
    v.innerHTML = `<div class="vilna-error"><div class="vilna-error-title">Vilna layout failed</div><div class="vilna-error-msg">${esc(e.message || e)}</div></div>`;
  }
}

function render() {
  const v = $('text-viewer');
  if (!v) return;
  const token = ++_renderToken;   // cancels any chunked render still streaming in
  _pendingFlush = null;
  // Vilna three-column layout for Gemara (async)
  if (corpus === 'gemara' && showVilna && chapters.length) {
    renderVilnaGemara();
    return;
  }
  v.classList.remove('vilna-mode');
  const ids = tikkun ? ['R', 'L'] : ['R'];
  const src = getSource();
  const hasReal = chapters.length > 0;
  v.classList.toggle('tikkun', tikkun);

  if (corpus === 'siddur' && hasReal && !src.length) {
    v.innerHTML = `<div class="empty-state"><div class="empty-icon">☑</div><div class="empty-title">Tick one or more sections</div><div class="empty-sub">Use the Sections menu above.</div></div>`;
    applyStyles(); return;
  }
  // Empty state when no book loaded (sample only if nothing chosen)
  if (!hasReal && !src.some(c => c.verses && c.verses.length && c.num)) {
    v.innerHTML = `<div class="empty-state">
      <div class="empty-icon">ספר</div>
      <div class="empty-title">Choose a book to begin</div>
      <div class="empty-sub">Pick a section and book above. On Tanach you can set a pasuk range and toggle Translation or Rashi.</div>
    </div>`;
    applyStyles();
    return;
  }

  let banner = '';
  if (pasukRange && (corpus === 'tanach' || corpus === 'mishna' || corpus === 'gemara')) {
    let left, right;
    if (corpus === 'gemara') {
      left = pasukRange.fromLabel || (pasukRange.from.ch + (pasukRange.from.v ? 'b' : 'a'));
      right = pasukRange.toLabel || (pasukRange.to.ch + (pasukRange.to.v ? 'b' : 'a'));
    } else if (corpus === 'mishna') {
      left = String(pasukRange.from.ch);
      right = String(pasukRange.to.ch);
    } else {
      const fmt = (r) => r.v >= 9999 ? String(r.ch) : `${r.ch}:${r.v}`;
      left = fmt(pasukRange.from); right = fmt(pasukRange.to);
    }
    banner = `<div class="range-banner">Showing ${left} – ${right} (inclusive)</div>`;
  }

  // Classic full render — entire selection in the DOM (no virtual list)
  v.classList.remove('has-rashi');
  if (v._virtScroll) {
    v.removeEventListener('scroll', v._virtScroll);
    v._virtScroll = null;
  }

  // Chunked render: build the first screenful right away, stream the rest in idle slices.
  // Each unit is a thunk, so HTML for off-screen verses is not even generated until its turn.
  const jobs = ids.map(id => {
    const stam = profiles[id].content === 'stam';
    const pieces = [];
    src.forEach((c, ci) => {
      if (c.label) pieces.push(() => `<div class="ch">${esc(String(c.label))}</div>`);
      const verseNums = c.verseNums || null;
      const isGemara = corpus === 'gemara';
      (c.verses || []).forEach((txt, i) => pieces.push(() => {
        const vnRaw = verseNums ? verseNums[i] : (i + 1);
        const vn = (corpus === 'tanach' || corpus === 'mishna') ? toGimatria(vnRaw) : vnRaw;
        const body = stam ? cleanVerse(txt).replace(STAM_RE, '') : cleanVerse(txt);
        let bodyHtml = textHTML(body)
          .replace(/§PETUCHA§/g, '<span class="parasha-gap petucha" aria-hidden="true"></span>')
          .replace(/§SETUMA§/g, '<span class="parasha-gap setuma" aria-hidden="true"></span>');
        const tag = lineBreakPostPasuk ? 'p' : 'span';
        const main = `<${tag} class="pasuk-unit">${c.num ? `<span class="vn">${vn}</span>` : ''}${bodyHtml}</${tag}>`;
        const idx = verseNums ? (verseNums[i] - 1) : i;

        let trHtml = '';
        if (showTranslation && translationChapters) {
          const tc = translationChapters.find(x => x.label === c.label);
          if (tc && tc.verses) {
            const en = tc.verses[idx];
            if (en) trHtml = `<div class="tr-block"><span class="layer-label">Translation</span>${esc(cleanVerse(String(en)))}</div>`;
          }
        }

        // For non-Gemara (Tanach/Mishnah): pair Rashi by verse index.
        // For Gemara: Rashi/Tosafot are comment lists, not per-segment — dump after the daf.
        let rhHtml = '';
        if (!isGemara && showRashi && rashiChapters) {
          const rc = rashiChapters.find(x => x.label === c.label) || rashiChapters[ci];
          if (rc && rc.verses) {
            const rh = rc.verses[idx];
            let enRh = '';
            if (showRashiEn && rashiEnChapters) {
              const rec = rashiEnChapters.find(x => x.label === c.label) || rashiEnChapters[ci];
              if (rec && rec.verses) {
                let e = rec.verses[idx];
                if (Array.isArray(e)) e = e.filter(Boolean).join(' ');
                if (e) enRh = `<div class="rashi-en"><span class="layer-label">Rashi (EN)</span>${esc(cleanVerse(String(e)))}</div>`;
              }
            }
            const hasRh = Array.isArray(rh) ? rh.some(Boolean) : !!rh;
            if (hasRh || enRh) {
              rhHtml += `<div class="pasuk-rashi"><span class="layer-label">רש״י</span>`
                + (hasRh ? `<div class="rashi-body">${commentaryHTML(rh)}</div>` : '')
                + enRh + `</div>`;
            }
          }
        }
        return main + trHtml + rhHtml;
      }));
      // Gemara: append all Rashi + Tosafot for this amud after its segments
      if (isGemara && (showRashi || showTosafot)) {
        pieces.push(() => {
          let html = '';
          if (showRashi && rashiChapters) {
            const rc = rashiChapters.find(x => x.label === c.label) || rashiChapters[ci];
            if (rc && rc.verses) {
              const allRh = (rc.verses || []).filter(v => {
                if (Array.isArray(v)) return v.some(Boolean);
                return !!v && String(v).trim();
              });
              if (allRh.length) {
                html += `<div class="pasuk-rashi"><span class="layer-label">רש״י</span><div class="rashi-body">${allRh.map(rh => commentaryHTML(rh)).join('')}</div></div>`;
              }
            }
          }
          if (showTosafot && tosafotChapters) {
            const tc = tosafotChapters.find(x => x.label === c.label) || tosafotChapters[ci];
            if (tc && tc.verses) {
              const allTh = (tc.verses || []).filter(v => {
                if (Array.isArray(v)) return v.some(Boolean);
                return !!v && String(v).trim();
              });
              if (allTh.length) {
                html += `<div class="pasuk-tosafot"><span class="layer-label">תוספות</span><div class="rashi-body">${allTh.map(th => commentaryHTML(th, { tosafot: true })).join('')}</div></div>`;
              }
            }
          }
          return html;
        });
      }
    });
    return { id, pieces, pos: 0 };
  });

  v.innerHTML = jobs.map(j => `<div class="pane" id="pane-${j.id}">${j.id === ids[0] ? banner : ''}</div>`).join('');
  v.classList.remove('is-preview');
  const loadBar = $('preview-load-bar');
  if (loadBar) loadBar.hidden = true;

  const FIRST_BUDGET = 90000; // characters of HTML for the initial locked preview
  const sliceInto = budget => {
    let more = false;
    jobs.forEach(j => {
      const pane = $('pane-' + j.id); if (!pane) return;
      let html = '';
      while (j.pos < j.pieces.length && html.length < budget) html += j.pieces[j.pos++]();
      if (html) {
        const before = pane.childElementCount;
        pane.insertAdjacentHTML('beforeend', html);
        if (profiles[j.id].sh.root) applyRoot(j.id, [...pane.children].slice(before));
      }
      if (j.pos < j.pieces.length) more = true;
    });
    return more;
  };
  let done = false;
  const setPreviewUI = (isPreview) => {
    v.classList.toggle('is-preview', isPreview);
    if (loadBar) loadBar.hidden = !isPreview;
    // Banner at the top of the first pane
    const firstPane = $('pane-' + ids[0]);
    if (firstPane) {
      const old = firstPane.querySelector('.preview-banner');
      if (old) old.remove();
      if (isPreview) {
        const b = document.createElement('div');
        b.className = 'preview-banner';
        b.innerHTML = `<span class="preview-badge">Preview</span> Only the first portion is shown on screen (word/root search cover this slice). <strong>Print Full Text</strong> opens the complete text in the print dialog.`;
        firstPane.insertBefore(b, firstPane.firstChild);
      }
    }
  };
  const finish = () => {
    if (done || token !== _renderToken) return;
    done = true; _pendingFlush = null;
    setPreviewUI(false);
    updateCount();
    requestAnimationFrame(() => { if (token === _renderToken) markPdfPageBreaks(); });
  };
  const more = sliceInto(FIRST_BUDGET);
  applyStyles();
  if (more) {
    // Stay locked on the first chunk. Print expands only for the print job, then restores.
    setPreviewUI(true);
    _pendingFlush = () => {
      // Expand for print only — afterprint will re-render the locked preview
      _restorePreviewAfterPrint = true;
      sliceInto(Infinity);
      // Don't call finish() — keep preview UI state; just make sure styles/counts are ok
      updateCount();
      applyStyles();
    };
    updateCount();
    requestAnimationFrame(() => { if (token === _renderToken) markPdfPageBreaks(); });
  } else {
    finish();
  }
}

/** Insert approximate PDF page-end markers into the preview pane.
 *  Measure first, mutate second — avoids layout thrashing on large texts.
 *  Briefly forces real layout so content-visibility:auto doesn't give
 *  tiny/wrong heights (which previously made only the page-1→2 mark appear). */
function markPdfPageBreaks() {
  document.querySelectorAll('.pdf-page-end').forEach(e => e.remove());
  if (!showPdfBreaks) return;
  const viewer = $('text-viewer');
  const panes = document.querySelectorAll('.pane');
  if (!viewer || !panes.length) return;

  viewer.classList.add('measuring-pages');
  void viewer.offsetHeight; // flush real layout

  panes.forEach(pane => {
    const kids = [...pane.children].filter(
      el => !el.classList.contains('pdf-page-end') && !el.classList.contains('range-banner')
    );
    if (!kids.length) return;

    // Phase 1: measure all positions (no DOM writes → no reflow thrashing)
    const tops = kids.map(el => el.offsetTop);
    const bottoms = kids.map((el, i) => tops[i] + el.offsetHeight);

    // Phase 2: decide insert points
    const inserts = []; // { beforeIndex, page }
    let page = 1;
    let nextBreak = PDF_PAGE_H;
    for (let i = 0; i < kids.length; i++) {
      const top = tops[i];
      const bottom = bottoms[i];
      while (top >= nextBreak - 4) {
        inserts.push({ beforeIndex: i, page });
        page++;
        nextBreak += PDF_PAGE_H;
      }
      while (bottom > nextBreak + 20) {
        page++;
        nextBreak += PDF_PAGE_H;
      }
    }

    // Phase 3: insert from the end so earlier indices stay valid
    for (let j = inserts.length - 1; j >= 0; j--) {
      const { beforeIndex, page: p } = inserts[j];
      const marker = document.createElement('div');
      marker.className = 'pdf-page-end';
      marker.setAttribute('aria-hidden', 'true');
      marker.innerHTML = `<span>PDF page ${p} ends</span>`;
      pane.insertBefore(marker, kids[beforeIndex]);
    }
  });

  viewer.classList.remove('measuring-pages');
}


function buildNikud() {
  const p = P();
  $('nk-dots').innerHTML = NIKUD.map(() => '<div class="dot"></div>').join('');
  $('nk-rows').innerHTML = '';
  NIKUD.forEach(n => {
    const k = p.nk.keys[n.k], row = document.createElement('div');
    row.className = 'nk-row';
    row.innerHTML = `<button class="swatch" style="background:${k.color}" aria-label="${n.n} colour"></button><span class="nk-char">ב${n.m}</span><span class="nk-label">${n.n}</span>` +
      `<label class="switch sm"><input type="checkbox" ${k.on ? 'checked' : ''}><span class="track"></span></label>`;
    const col = row.children[0], sw = row.querySelector('input');
    col.onclick = () => openPicker({ title: n.n + ' colour', preview: 'ב' + n.m, color: k.color, def: n.c, all: true,
      onApply: c => { k.color = c; col.style.background = c; applyStyles(); } });
    sw.onchange = () => { k.on = sw.checked; applyStyles(); };
    row._sw = sw;
    $('nk-rows').appendChild(row);
  });
}
function buildTropes() {
  const p = P();
  const dots = $('tp-dots');
  if (dots) dots.innerHTML = TROPES.map(() => '<div class="dot"></div>').join('');
  const rows = $('tp-rows');
  if (!rows) return;
  rows.innerHTML = '';
  TROPES.forEach(t => {
    const k = p.tp.keys[t.k], row = document.createElement('div');
    row.className = 'nk-row';
    row.innerHTML = `<button class="swatch" style="background:${k.color}" aria-label="${t.n} colour"></button><span class="nk-char">ב${t.m}</span><span class="nk-label">${t.n}</span>` +
      `<label class="switch sm"><input type="checkbox" ${k.on ? 'checked' : ''}><span class="track"></span></label>`;
    const col = row.children[0], sw = row.querySelector('input');
    col.onclick = () => openPicker({ title: t.n + ' colour', preview: 'ב' + t.m, color: k.color, def: t.c, all: false,
      onApply: c => { k.color = c; col.style.background = c; applyStyles(); } });
    sw.onchange = () => { k.on = sw.checked; applyStyles(); };
    row._sw = sw;
    rows.appendChild(row);
  });
}
function loadControls() {
  const p = P();
  $('nk-on').checked = p.nk.on; setSeg('nk-mode', p.nk.mode); $('nk-op').value = p.nk.op; $('nk-op-val').textContent = p.nk.op + '%';
  buildNikud();
  $('sh-on').checked = p.sh.on; $('sh-root').value = p.sh.root; setSeg('sh-mode', p.sh.mode); setSwatch('sh-color', p.sh.color);
  $('sh-op').value = p.sh.op; $('sh-op-val').textContent = p.sh.op + '%';
  $('tp-on').checked = p.tp.on; setSeg('tp-mode', p.tp.mode);
  $('tp-op').value = p.tp.op; $('tp-op-val').textContent = p.tp.op + '%';
  buildTropes();
  p.ls = Math.round(+p.ls) || 0;
  $('font-picker').value = p.font; $('ls').value = p.ls; $('ls-val').textContent = p.ls + 'px'; $('fs').value = p.fs;
  setSeg('side-seg', side); setSeg('content-seg', p.content);
  applyStyles(); updateCount();
}
const HL = ['nk', 'sh', 'tp'], HL_SW = { nk: 'nk-on', sh: 'sh-on', tp: 'tp-on' };
function setHighlight(key, on) {
  const p = P(); p[key].on = on;
  if (on) HL.forEach(k => { if (k !== key) { p[k].on = false; $(HL_SW[k]).checked = false; } });
  $(HL_SW[key]).checked = on;
  applyRoots(); applyStyles(); updateCount();
}
function setAll(on) { NIKUD.forEach(n => P().nk.keys[n.k].on = on); [...$('nk-rows').children].forEach(r => r._sw.checked = on); applyStyles(); }
function setAllTropes(on) {
  TROPES.forEach(t => { if (P().tp.keys[t.k]) P().tp.keys[t.k].on = on; });
  const rows = $('tp-rows');
  if (rows) [...rows.children].forEach(r => { if (r._sw) r._sw.checked = on; });
  applyStyles();
}

/* Colour picker modal (same look as the popup's) */
const PALETTE = ['#cc0000', '#e5484d', '#ff88aa', '#ff00ff', '#9900ff', '#6f42c1', '#0000ff', '#29abe2', '#6fa8dc', '#00bcd4', '#00cc00', '#6aa84f',
  '#a3d977', '#cccc00', '#e8b840', '#ff9900', '#ff6d00', '#8d5524', '#000000', '#555555', '#999999', '#cccccc', '#ffffff', '#0d2340'];
let cp = null;
function cpSet(c) {
  cp.cur = c; $('cp-hex').value = c.slice(1).toUpperCase(); $('cp-hex').classList.remove('invalid');
  $('cp-preview').style.background = c;
  [...$('cp-grid').children].forEach(x => x.classList.toggle('selected', x.dataset.c === c));
}
function openPicker(o) {
  cp = o; $('cp-title').textContent = o.title; $('cp-preview').textContent = o.preview || 'א';
  $('cp-grid').innerHTML = PALETTE.map(c => `<button class="cp-chip" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join('');
  $('cp-resetall').style.display = o.all ? 'block' : 'none';
  cpSet(o.color); $('cp-overlay').classList.add('open');
}
const closePicker = () => { $('cp-overlay').classList.remove('open'); cp = null; };
function initPicker() {
  $('cp-grid').onclick = e => { const b = e.target.closest('.cp-chip'); if (b) cpSet(b.dataset.c); };
  $('cp-hex').oninput = e => {
    let v = e.target.value.replace('#', '').trim();
    if (/^[0-9a-f]{3}$/i.test(v)) v = [...v].map(x => x + x).join('');
    const ok = /^[0-9a-f]{6}$/i.test(v);
    e.target.classList.toggle('invalid', !ok && v.length > 0);
    if (ok) { cp.cur = '#' + v.toLowerCase(); $('cp-preview').style.background = cp.cur; [...$('cp-grid').children].forEach(x => x.classList.toggle('selected', x.dataset.c === cp.cur)); }
  };
  $('cp-reset').onclick = () => cpSet(cp.def);
  $('cp-apply').onclick = () => { cp.onApply(cp.cur); closePicker(); };
  $('cp-cancel').onclick = $('cp-close').onclick = closePicker;
  $('cp-overlay').onclick = e => { if (e.target.id === 'cp-overlay') closePicker(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && cp) closePicker(); });
  $('cp-resetall').onclick = () => { NIKUD.forEach(n => P().nk.keys[n.k].color = n.c); buildNikud(); applyStyles(); closePicker(); };
  const bind = (id, grp, title, preview, def) => { $(id).onclick = () => openPicker({ title, preview, color: P()[grp].color, def,
    onApply: c => { P()[grp].color = c; setSwatch(id, c); applyStyles(); } }); };
  bind('sh-color', 'sh', 'Shoresh colour', 'שׁ', '#e8b840');
}

/* ───────── Library: Sefaria_Library_Reorganized folder ───────── */
// Canonical order, so books list in a logical order instead of alphabetically.
const TANAKH = { 'Torah': 'genesis exodus leviticus numbers deuteronomy',
  "Nevi'im": 'joshua judges isamuel iisamuel ikings iikings isaiah jeremiah ezekiel hosea joel amos obadiah jonah micah nahum habakkuk zephaniah haggai zechariah malachi',
  'Ketuvim': 'psalms proverbs job songofsongs ruth lamentations ecclesiastes esther daniel ezra nehemiah ichronicles iichronicles' };
const SEDARIM = { 'Zeraim': 'berakhot peah demai kilayim sheviit terumot maasrot maasersheni challah orlah bikkurim',
  'Moed': 'shabbat eruvin pesachim shekalim yoma sukkah beitzah roshhashanah taanit megillah moedkatan chagigah',
  'Nashim': 'yevamot ketubot nedarim nazir sotah gittin kiddushin',
  'Nezikin': 'bavakamma bavametzia bavabatra sanhedrin makkot shevuot eduyot avodahzarah avot pirkeiavot horayot',
  'Kodashim': 'zevachim menachot chullin bekhorot arakhin temurah keritot meilah tamid middot kinnim',
  'Tahorot': 'kelim oholot negaim parah tahorot mikvaot niddah makhshirin zavim tevulyom yadayim oktzin' };
const SECMAP = { tanach: TANAKH, mishna: SEDARIM, gemara: SEDARIM };
const FOLDER_CORPUS = { tanakh: 'tanach', tanach: 'tanach', mishnah: 'mishna', mishna: 'mishna', gemara: 'gemara', talmud: 'gemara', siddur: 'siddur' };
const SUFFIX = { tanach: / Hebrew$/, mishna: / Mishnah Hebrew$/, gemara: / Gemara Hebrew$/, siddur: / Hebrew$/ };
const keyOf = t => t.toLowerCase()
  .replace(/^i\s+/, 'i ').replace(/^ii\s+/, 'ii ')
  .replace(/^1\s+/, 'i ').replace(/^2\s+/, 'ii ')
  .replace(/[''`]/g, '')
  .replace(/[^a-z]/g, '');

function place(c, title) {
  const map = SECMAP[c];
  if (!map) return { section: c === 'siddur' ? 'Siddur' : 'All', ord: 0, si: 0 };
  const k = keyOf(title);
  let si = 0;
  for (const [sec, list] of Object.entries(map)) {
    const o = list.split(' ').indexOf(k);
    if (o >= 0) return { section: sec, ord: o, si };
    si++;
  }
  return { section: 'Other', ord: 999, si: 99 };
}

const LIB_FOLDERS = {
  tanach: '01_Tanakh', mishna: '02_Mishnah', gemara: '03_Gemara', siddur: '04_Siddur'
};
const LIB_BASE = './texts';

function cleanTitle(raw, c) {
  let t = (raw || '').replace(/\.json$/i, '');
  // strip language / corpus suffixes in any order
  t = t.replace(/\s+Hebrew$/i, '')
       .replace(/\s+Mishnah$/i, '')
       .replace(/\s+Gemara$/i, '')
       .replace(/\s+English$/i, '')
       .replace(/;/g, '')
       .trim();
  return t;
}

function finishLibraryLoad(label) {
  const n = c => (library[c] || []).length;
  const total = n('tanach') + n('mishna') + n('gemara') + n('siddur');
  setStatus('status-texts',
    `${label}: ${n('tanach')} Tanakh · ${n('mishna')} Mishnah · ${n('gemara')} Gemara · ${n('siddur')} Siddur`,
    total > 0);
  document.querySelectorAll('.tab').forEach(tab => {
    tab.disabled = !n(tab.dataset.c);
  });
  if (!n(corpus)) {
    const first = ['tanach', 'mishna', 'gemara', 'siddur'].find(c => n(c));
    if (first) {
      corpus = first;
      document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x.dataset.c === first));
    }
  }
  updateTanachToolsVisibility(); updateChapterUI();
  fillSections();
}

// Always load the library from the local relative path ./texts
// (same folder layout as the app: OtiyotPress/texts/…).
async function tryAutoLoad() {
  try {
    const catRes = await fetch(`${LIB_BASE}/00_Catalog_Index.json`);
    if (!catRes.ok) {
      setStatus('status-texts',
        location.protocol === 'file:'
          ? 'Serve the app (npx serve) so ./texts can load'
          : 'Could not load ./texts/00_Catalog_Index.json',
        false);
      return false;
    }
    const catalog = await catRes.json();
    library = { tanach: [], mishna: [], gemara: [], siddur: [] };
    const sectionMap = { Tanakh: 'tanach', Mishnah: 'mishna', Gemara: 'gemara', Siddur: 'siddur' };
    for (const [secName, sec] of Object.entries(catalog.sections || {})) {
      const c = sectionMap[secName];
      if (!c || !Array.isArray(sec.books)) continue;
      for (const b of sec.books) {
        const origTitle = b.title || '';
        const rawTitle = origTitle.replace(/;/g, '');
        if (/Rashi|Tosafot/i.test(rawTitle)) continue;
        const title = cleanTitle(rawTitle, c);
        if (!title) continue;
        const folder = LIB_FOLDERS[c];
        const fileName = encodeURIComponent(origTitle + '.json');
        library[c].push({
          title,
          origTitle: rawTitle, // e.g. "Genesis Hebrew" — used to resolve Rashi filenames
          url: `${LIB_BASE}/${folder}/${fileName}`,
          // Pre-resolved Rashi path (Tanach only) so we don't guess filenames later
          rashiUrl: c === 'tanach'
            ? `${LIB_BASE}/05_Commentaries/${encodeURIComponent(title + ' Rashi Hebrew.json')}`
            : null,
          ...place(c, title)
        });
      }
      library[c].sort((x, y) => x.si - y.si || x.ord - y.ord || x.title.localeCompare(y.title));
    }
    libraryMode = 'fetch';
    finishLibraryLoad('Library (auto)');
    toast('Library ready', 'ok');
    return (library.tanach.length + library.mishna.length + library.gemara.length + library.siddur.length) > 0;
  } catch (e) {
    console.warn('Auto-load failed (open via local server, or pick the texts folder):', e);
    setStatus('status-texts',
      location.protocol === 'file:'
        ? 'Serve the app (npx serve) so ./texts can load'
        : ('Could not load ./texts: ' + (e.message || e)),
      false);
    return false;
  }
}

async function scanTexts(dir) {
  library = { tanach: [], mishna: [], gemara: [], siddur: [] };
  libraryMode = 'fs';
  rashiHandles.clear();

  // Accept either the "texts" folder (01_Tanakh/…) or its parent (OtiyotPress/ with texts/)
  let root = dir;
  let hasNumbered = false;
  for await (const e of dir.values()) {
    if (e.kind === 'directory' && /^\d+_/.test(e.name)) { hasNumbered = true; break; }
  }
  if (!hasNumbered) {
    // maybe user picked the app root — look for a "texts" child
    for await (const e of dir.values()) {
      if (e.kind === 'directory' && /^(texts|Sefaria_Library_Reorganized)$/i.test(e.name)) {
        root = e;
        break;
      }
    }
  }

  for await (const e of root.values()) {
    if (e.kind !== 'directory') continue;
    const m = e.name.match(/^\d+_(.+)$/);
    const folderKey = m ? m[1].toLowerCase() : '';

    // Special case: Commentaries → index Rashi + Tosafot for offline use
    if (/commentar/.test(folderKey)) {
      for await (const f of e.values()) {
        if (f.kind !== 'file' || !/\.json$/i.test(f.name)) continue;
        const raw = f.name.replace(/\.json$/i, '');
        const rm = raw.match(/^(.+?)\s+Rashi\s+(Hebrew|English)$/i);
        if (rm) {
          const book = rm[1].trim();
          const lang = rm[2].toLowerCase();
          if (lang === 'hebrew') {
            rashiHandles.set(book, f);
            rashiHandles.set(book.toLowerCase(), f);
          } else {
            rashiHandles.set(book + '::en', f);
            rashiHandles.set(book.toLowerCase() + '::en', f);
          }
          continue;
        }
        const tm = raw.match(/^(.+?)\s+Tosafot\s+Hebrew$/i);
        if (tm) {
          const book = tm[1].trim();
          rashiHandles.set(book + '::tos', f);
          rashiHandles.set(book.toLowerCase() + '::tos', f);
        }
      }
      continue;
    }

    const c = FOLDER_CORPUS[folderKey];
    if (!c) continue;
    const all = [];
    for await (const f of e.values()) {
      if (f.kind === 'file' && /\.json$/i.test(f.name)) all.push(f);
    }
    const heb = all.filter(f => /Hebrew\.json$/i.test(f.name));
    (heb.length ? heb : all).forEach(f => {
      const raw = f.name.replace(/\.json$/i, '');
      if (/Rashi|Tosafot/i.test(raw)) return;
      const title = cleanTitle(raw, c);
      library[c].push({ title, origTitle: raw, handle: f, ...place(c, title) });
    });
    library[c].sort((x, y) => x.si - y.si || x.ord - y.ord || x.title.localeCompare(y.title));
  }

  // Attach rashiHandle onto each Tanach book when we found a matching file
  (library.tanach || []).forEach(item => {
    const h = rashiHandles.get(item.title) || rashiHandles.get((item.title || '').toLowerCase());
    if (h) item.rashiHandle = h;
  });

  finishLibraryLoad(dir.name);
  if (rashiHandles.size) {
    toast(`Offline library ready · ${rashiHandles.size / 2 | 0} Rashi files`, 'ok');
  }
}

function fillSections() {
  const items = library[corpus] || [];
  const cat = $('select-category');
  const titleSel = $('select-title');
  const chapSel = $('select-chapter');
  if (!cat || !titleSel) return;

  if (!items.length) {
    cat.innerHTML = '<option value="">No books loaded</option>';
    titleSel.innerHTML = '<option value="">Book</option>';
    if (chapSel) chapSel.innerHTML = '<option value="">Chapter</option>';
    return;
  }

  // Preserve order of first appearance (canonical via place())
  const secs = [];
  const seen = new Set();
  items.forEach(x => {
    if (!seen.has(x.section)) { seen.add(x.section); secs.push(x.section); }
  });

  cat.innerHTML = secs.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  // Ensure a section is selected
  if (!cat.value && secs.length) cat.value = secs[0];
  fillBooks();
}

function fillBooks() {
  const cat = $('select-category');
  const titleSel = $('select-title');
  if (!cat || !titleSel) return;
  const sec = cat.value;
  const items = library[corpus] || [];
  const opts = ['<option value="">Book</option>'];
  items.forEach((x, i) => {
    if (x.section === sec) opts.push(`<option value="${i}">${esc(x.title)}</option>`);
  });
  titleSel.innerHTML = opts.join('');
  // Clear chapters until a book is chosen
  const chapSel = $('select-chapter');
  if (chapSel) chapSel.innerHTML = '<option value="">Chapter</option>';
  chapters = [];
  siddurSel = new Set();
  buildSiddurPicker(); updateChapterUI();
  render(); // clear stale text from previous book/section
}

const CH_WORD = { tanach: 'Chapter ', mishna: 'Chapter ', gemara: 'Daf ', siddur: '' };

function updateChapterUI() {
  const sid = corpus === 'siddur';
  const hasChapters = chapters.length > 0;
  const cs = $('select-chapter'), pk = $('siddur-picker');
  // Chapter dropdown only for Tanach / Mishnah / Gemara
  if (cs) cs.hidden = sid || !hasChapters;
  // Siddur multi-select picker
  if (pk) pk.hidden = !(sid && hasChapters);
  // Prev/Next arrows only when chapter dropdown is usable
  const showArrows = !sid && hasChapters;
  ['ch-prev', 'ch-next'].forEach(id => { const b = $(id); if (b) b.hidden = !showArrows; });
}
function updateSiddurCount() {
  const e = $('siddur-count'); if (e) e.textContent = `Sections (${siddurSel.size}/${chapters.length})`;
}

/** Split a Siddur label into service / section / item
 *  "Shacharis · Pesukei D'Zimra · Baruch She'amar"
 *    → { service: "Shacharis", section: "Pesukei D'Zimra", item: "Baruch She'amar" }
 *  "Mincha · Ashrei"
 *    → { service: "Mincha", section: "", item: "Ashrei" }
 *  "Birkas HaMazon"
 *    → { service: "", section: "", item: "Birkas HaMazon" }
 */
function siddurLabelParts(label) {
  const parts = String(label).split(/\s*·\s*/).filter(Boolean);
  if (parts.length >= 3) {
    return { service: parts[0], section: parts[1], item: parts.slice(2).join(' · ') };
  }
  if (parts.length === 2) {
    return { service: parts[0], section: '', item: parts[1] };
  }
  return { service: '', section: '', item: parts[0] || label };
}

function buildSiddurPicker() {
  const box = $('siddur-list'); if (!box) return;
  if (corpus !== 'siddur' || !chapters.length) {
    box.innerHTML = '';
    updateSiddurCount();
    return;
  }

  // ── Level 1: Weekday / Shabbos / Yom Tov / Other ──────────────────────
  const catOrder = ['Weekday', 'Shabbos', 'Yom Tov', 'Other'];
  const byCat = {};
  chapters.forEach((c, i) => {
    const cat = c.category || 'Other';
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push({ c, i, parts: siddurLabelParts(c.label) });
  });

  let html = '';
  for (const cat of catOrder) {
    const catItems = byCat[cat];
    if (!catItems || !catItems.length) continue;

    const checkedInCat = catItems.filter(({ i }) => siddurSel.has(i)).length;

    // ── Level 2: service (Shacharis / Mincha / Kabbalas Shabbos …) ──────
    const byService = {};
    const serviceOrder = [];
    catItems.forEach(entry => {
      const svc = entry.parts.service || 'General';
      if (!byService[svc]) { byService[svc] = []; serviceOrder.push(svc); }
      byService[svc].push(entry);
    });

    html += `<details class="sid-cat"${checkedInCat ? ' open' : ''}>
      <summary class="sid-cat-sum">
        <span class="sid-cat-name">${esc(cat)}</span>
        <span class="sid-cat-count">${checkedInCat}/${catItems.length}</span>
      </summary>
      <div class="sid-cat-body">`;

    for (const svc of serviceOrder) {
      const svcItems = byService[svc];
      const showServiceHeader = serviceOrder.length > 1 && svc !== 'General';

      if (showServiceHeader) {
        const checkedInSvc = svcItems.filter(({ i }) => siddurSel.has(i)).length;
        html += `<details class="sid-svc"${checkedInSvc ? ' open' : ''}>
          <summary class="sid-svc-sum">
            <span class="sid-svc-name">${esc(svc)}</span>
            <span class="sid-svc-count">${checkedInSvc}/${svcItems.length}</span>
          </summary>
          <div class="sid-svc-body">`;
      }

      // ── Level 3: section headers (Pesukei D'Zimra, Birchos HaShachar…) ─
      const bySection = {};
      const sectionOrder = [];
      svcItems.forEach(entry => {
        const sec = entry.parts.section || '';
        if (!bySection[sec]) { bySection[sec] = []; sectionOrder.push(sec); }
        bySection[sec].push(entry);
      });

      for (const sec of sectionOrder) {
        const secItems = bySection[sec];
        if (sec) {
          html += `<div class="sid-sec-title">${esc(sec)}</div>`;
        }
        html += secItems.map(({ i, parts }) => {
          const display = parts.item || parts.section || parts.service || 'Prayer';
          return `<label class="chk"><input type="checkbox" data-i="${i}" ${siddurSel.has(i) ? 'checked' : ''}><span>${esc(display)}</span></label>`;
        }).join('');
      }

      if (showServiceHeader) {
        html += `</div></details>`;
      }
    }

    html += `</div></details>`;
  }

  box.innerHTML = html;
  updateSiddurCount();
}
function fillChapterSelect() {
  const chapSel = $('select-chapter');
  const visible = getVisibleChapters();
  if (chapSel) {
    const prev = chapSel.value;
    chapSel.innerHTML =
      visible.map((c, i) => `<option value="${i}">${CH_WORD[corpus] || ''}${esc(c.label)}</option>`).join('') +
      (visible.length > 1 ? '<option value="all">Whole selection</option>' : '');
    if (visible.length) {
      if (prev === 'all') chapSel.value = 'all';
      else {
        const keep = parseInt(prev, 10);
        chapSel.value = (Number.isFinite(keep) && keep >= 0 && keep < visible.length) ? String(keep) : '0';
      }
    }
  }
  siddurSel = new Set(corpus === 'siddur' && chapters.length ? [0] : []);
  buildSiddurPicker(); updateChapterUI();
}

async function applyTanachOptions() {
  const titleSel = $('select-title');
  const item = (library[corpus] || [])[titleSel && titleSel.value !== '' ? +titleSel.value : -1];
  const bookTitle = item ? item.title : null;
  const loadToken = ++_renderToken; // cancel if user switches book while we await

  pasukRange = parseRangeFromBoxes();
  if (($('range-from') && $('range-from').value.trim() || $('range-to') && $('range-to').value.trim()) && !pasukRange) {
    toast('Could not parse range — use e.g. From 1:14  To 6:20', 'warn');
  }

  // Only fetch what is newly needed; layers already loaded stay in memory so toggling is instant.
  if (showRashi && bookTitle && !rashiChapters) {
    toast('Loading Rashi…');
    const loaded = await loadSideText(
      bookTitle, 'rashi-he',
      item && item.origTitle,
      item && item.rashiUrl,
      item && item.rashiHandle
    );
    if (loadToken !== _renderToken) return; // user switched sefer
    rashiChapters = loaded;
    if (!rashiChapters) {
      const viaFile = location.protocol === 'file:';
      toast(viaFile
        ? 'Serve the app (npx serve) so Rashi can load from ./texts'
        : 'No Rashi found for ' + bookTitle + ' — check texts/05_Commentaries', 'warn');
    } else {
      rashiChapters = alignCommentaryLabels(rashiChapters);
      toast('Rashi ready · ' + rashiChapters.length + ' sections', 'ok');
    }
  }
  if (showRashi && showRashiEn && bookTitle && !rashiEnChapters) {
    toast('Loading Rashi (EN)…');
    const enUrl = item && item.rashiUrl
      ? item.rashiUrl.replace('Rashi%20Hebrew', 'Rashi%20English').replace('Rashi Hebrew', 'Rashi English')
      : null;
    const loadedEn = await loadSideText(bookTitle, 'rashi-en', item && item.origTitle, enUrl, null);
    if (loadToken !== _renderToken) return;
    rashiEnChapters = loadedEn;
    if (!rashiEnChapters) toast('No English Rashi for ' + bookTitle, 'warn');
  }
  if (showTosafot && bookTitle && corpus === 'gemara' && !tosafotChapters) {
    toast('Loading Tosafot…');
    const loadedTos = await loadSideText(bookTitle, 'tosafot-he', item && item.origTitle, null, null);
    if (loadToken !== _renderToken) return;
    tosafotChapters = loadedTos;
    if (!tosafotChapters) toast('No Tosafot for ' + bookTitle, 'warn');
    else {
      tosafotChapters = alignCommentaryLabels(tosafotChapters);
      toast('Tosafot ready · ' + tosafotChapters.length + ' sections', 'ok');
    }
  }

  if (loadToken !== _renderToken) return;
  // Rebuild chapter list from the active range (one section shown at a time)
  fillChapterSelect();
  if (showTranslation && bookTitle) { toast('Loading translation…'); await ensureTranslation(); }
  if (loadToken !== _renderToken) return;
  render();

  if (pasukRange) {
    const a = pasukRange.from, b = pasukRange.to;
    const fmt = (r) => {
      if (corpus === 'gemara') return pasukRange.fromLabel || (r.ch + (r.v ? 'b' : 'a'));
      if (corpus === 'mishna') return String(r.ch);
      return r.v >= 9999 ? String(r.ch) : `${r.ch}:${r.v}`;
    };
    const visible = getVisibleChapters();
    const n = visible.reduce((s, c) => s + (c.verses ? c.verses.length : 0), 0);
    if (n === 0) {
      const err = rangeBoundsError(pasukRange, chapters);
      toast(err || `Range ${fmt(a)}–${fmt(b)} not found`, 'warn');
    } else {
      toast(`Range ${fmt(a)}–${fmt(b)} · ${visible.length} section${visible.length === 1 ? '' : 's'}`, 'ok');
    }
  }
}

const openBook = guard(async () => {
  const titleSel = $('select-title');
  if (!titleSel || titleSel.value === '') return;
  const item = (library[corpus] || [])[+titleSel.value];
  if (!item) return;

  rashiChapters = null;
  rashiEnChapters = null;
  tosafotChapters = null;
  translationChapters = null;

  // Gemara + Vilna: daf list + text from local JSON only (no Sefaria)
  if (corpus === 'gemara' && showVilna) {
    toast('Loading local daf list…');
    try {
      let labels;
      if (typeof VilnaGemara !== 'undefined' && VilnaGemara.listDafim) {
        labels = await VilnaGemara.listDafim(item.title);
      } else {
        // Fallback: derive labels from local Gemara file using real array indexes
        const res = await fetch('./texts/03_Gemara/' + encodeURIComponent(item.title + ' Gemara Hebrew.json'));
        if (!res.ok) throw new Error('Missing local Gemara for ' + item.title);
        const j = await res.json();
        const root = j.text || j.he || [];
        labels = [];
        root.forEach((seg, i) => {
          if (!seg || (Array.isArray(seg) && !seg.length)) return;
          const x = i + 2;
          labels.push(Math.floor(x / 2) + (x % 2 === 0 ? 'a' : 'b'));
        });
      }
      if (!labels.length) throw new Error('No amudim in local file for ' + item.title);
      chapters = labels.map(label => ({ label, verses: [''] }));
      fillChapterSelect();
      updateTanachToolsVisibility();
      const chapSel = $('select-chapter');
      if (chapSel && chapters.length) chapSel.value = '0';
      toast(item.title + ' · ' + labels.length + ' amudim (local)', 'ok');
      render();
      return;
    } catch (e) {
      console.warn(e);
      toast(e.message || 'Local Vilna data missing', 'warn');
      // fall through to non-Vilna local JSON view
    }
  }

  let j;
  if (item.url) {
    if (_bookJsonCache.has(item.url)) j = _bookJsonCache.get(item.url);
    else {
      const res = await fetch(item.url);
      if (!res.ok) throw new Error('Could not load ' + item.title + ' (' + res.status + ')');
      j = await res.json();
      _bookJsonCache.set(item.url, j);
    }
  } else if (item.handle) {
    j = JSON.parse(await (await item.handle.getFile()).text());
  } else {
    throw new Error('No source for ' + item.title);
  }

  const root = j.text ?? (j.versions && j.versions[0] && j.versions[0].text) ?? j.he ?? j;
  if (corpus === 'gemara' && Array.isArray(root) && root.some(Array.isArray)) {
    // Use real array index so gaps and non-2a starts (e.g. Tamid 25b) label correctly
    chapters = [];
    root.forEach((seg, i) => {
      const verses = toChapters(seg).flatMap(c => c.verses).filter(Boolean);
      if (!verses.length) return;
      const x = i + 2;
      const label = Math.floor(x / 2) + (x % 2 === 0 ? 'a' : 'b');
      chapters.push({ label, verses });
    });
  } else if (corpus === 'siddur') {
    chapters = toSiddurChapters(root).filter(c => c.verses && c.verses.length);
  } else {
    chapters = toChapters(root);
    chapters = chapters.filter(c => c.verses && c.verses.length);
  }

  fillChapterSelect();
  updateTanachToolsVisibility();
  if (item) toast(item.title, 'ok');
  if (corpus === 'tanach' || corpus === 'mishna' || corpus === 'gemara') {
    await applyTanachOptions();
  } else {
    render();
  }
});

const onChapterChange = guard(async () => {
  // Choosing a specific chapter clears any active range so the dropdown works
  if (pasukRange) {
    pasukRange = null;
    if ($('range-from')) $('range-from').value = '';
    if ($('range-to')) $('range-to').value = '';
    if ($('pasuk-range')) $('pasuk-range').value = '';
  }
  render();
  if (showTranslation && await ensureTranslation()) render();
});
function stepChapter(d) {
  const s = $('select-chapter');
  if (!s || !s.options.length) return;
  // Clear range so arrows navigate chapters instead of being overridden
  if (pasukRange) {
    pasukRange = null;
    if ($('range-from')) $('range-from').value = '';
    if ($('range-to')) $('range-to').value = '';
    if ($('pasuk-range')) $('pasuk-range').value = '';
  }
  const i = s.selectedIndex + d;
  if (i >= 0 && i < s.options.length) {
    s.selectedIndex = i;
    onChapterChange();
  }
}

/* ───────── Folder importers (remembered between sessions) ───────── */
async function* walkFiles(dir) {
  for await (const e of dir.values()) { if (e.kind === 'file') yield e; else yield* walkFiles(e); }
}
function parseCSV(text) {
  rootRows = []; rootOcc = new Map();
  text.replace(/^\uFEFF/, '').split('\n').slice(1).forEach(line => {
    if (!line.trim()) return;
    const row = []; let q = false, cur = '';
    for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { row.push(cur); cur = ''; } else cur += ch; }
    row.push(cur);
    const root = normRoot((row[0] || '').trim()); if (!root) return;
    rootOcc.set(root, row[2]);
    rootRows.push({ root, occ: row[2], ex: (row[53] || '').trim() });
  });
}
async function scanRoots(dir) {
  const csvs = []; for await (const f of walkFiles(dir)) if (/\.csv$/i.test(f.name)) csvs.push(f);
  const pick = csvs.find(f => /master/i.test(f.name)) || csvs[0];
  if (!pick) throw new Error('No .csv file found in that folder.');
  parseCSV(await (await pick.getFile()).text());
  setStatus('status-csv', `${pick.name} (${rootRows.length} roots)`);
  updateCount();
}
async function scanFonts(dir) {
  let bad = 0;
  for await (const h of walkFiles(dir)) {
    if (!/\.(otf|ttf|woff2?)$/i.test(h.name) || fonts.some(f => f.file === h.name)) continue;
    try {
      const name = 'UserFont_' + h.name.replace(/[^a-zA-Z0-9]/g, '_');
      const ff = new FontFace(name, await (await h.getFile()).arrayBuffer()); await ff.load(); document.fonts.add(ff);
      fonts.push({ name, file: h.name, label: fontLabel(h.name) });
    } catch (e) { bad++; }
  }
  {
    const dyslex = fonts.find(f => /dyslex/i.test(f.file) || f.name === DYSLEX_FONT);
    const others = fonts.filter(f => f !== dyslex);
    let opts = '';
    if (dyslex) {
      opts += `<option value="${esc(dyslex.name)}">${esc(dyslex.label || 'Dyslex-Kriyah')} (Default)</option>`;
    }
    opts += '<option value="Rubik">Rubik</option>';
    opts += others.map(f => `<option value="${esc(f.name)}">${esc(f.label || fontLabel(f.file))}</option>`).join('');
    $('font-picker').innerHTML = opts;
    if (dyslex && (P().font === 'Rubik' || P().font === DYSLEX_FONT || !fonts.some(f => f.name === P().font))) {
      profiles.R.font = dyslex.name;
      profiles.L.font = dyslex.name;
    }
    $('font-picker').value = P().font;
  }
  setStatus('status-fonts', `${fonts.length} font(s) loaded` + (bad ? `, ${bad} skipped` : ''), fonts.length > 0);
}
const FOLDERS = { texts: { scan: scanTexts, st: 'status-texts' }, roots: { scan: scanRoots, st: 'status-csv' }, fonts: { scan: scanFonts, st: 'status-fonts' } };
const idb = () => new Promise((res, rej) => { const r = indexedDB.open('otiyot-press', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const idbGet = async k => { try { const db = await idb(); return await new Promise(r => { const q = db.transaction('h').objectStore('h').get(k); q.onsuccess = () => r(q.result); q.onerror = () => r(null); }); } catch (e) { return null; } };
const idbSet = async (k, v) => { try { (await idb()).transaction('h', 'readwrite').objectStore('h').put(v, k); } catch (e) { /* remembering is optional */ } };
// Click = reconnect the remembered folder (one permission click); pencil = choose a different one.
async function openFolder(key, forcePick) {
  const h = !forcePick && await idbGet(key);
  if (h) {
    try {
      if ((await h.queryPermission({ mode: 'read' })) === 'granted' || (await h.requestPermission({ mode: 'read' })) === 'granted') { await FOLDERS[key].scan(h); return; }
    } catch (e) { /* fall through to the picker */ }
  }
  const d = await showDirectoryPicker({ mode: 'read' });
  await FOLDERS[key].scan(d); await idbSet(key, d);
}
/** Conversational display label from a font filename (strips extension). */
function fontLabel(file) {
  return String(file || '').replace(/\.(otf|ttf|woff2?)$/i, '');
}

async function tryAutoFonts() {
  // Filenames match the friendly names on disk under ./fonts/
  const fontFiles = [
    'Koren.otf',
    'Koren Bold.otf',
    'Hadasim.otf',
    'Frank Ruehl.otf',
    'Shlomo Stam.otf',
    'Torah no crown.otf',
    'Ashkenaz Torah.otf',
    'Sefarad Torah.otf',
    'Rashi.otf',
    'Dyslex-Kriyah.otf'
  ];
  let loaded = 0;
  for (const file of fontFiles) {
    if (fonts.some(f => f.file === file)) continue;
    try {
      const name = 'UserFont_' + file.replace(/[^a-zA-Z0-9]/g, '_');
      const ff = new FontFace(name, `url(./fonts/${encodeURIComponent(file)})`);
      await ff.load();
      document.fonts.add(ff);
      fonts.push({ name, file, label: fontLabel(file) });
      loaded++;
    } catch (e) { /* missing or file:// blocked */ }
  }
  if (loaded || fonts.length) {
    const sel = $('font-picker');
    if (sel) {
      const dyslex = fonts.find(f => f.file === 'Dyslex-Kriyah.otf' || f.name === DYSLEX_FONT);
      const others = fonts.filter(f => f !== dyslex);
      let opts = '';
      if (dyslex) {
        opts += `<option value="${esc(dyslex.name)}">${esc(dyslex.label || 'Dyslex-Kriyah')} (Default)</option>`;
      }
      opts += '<option value="Rubik">Rubik</option>';
      opts += others.map(f => `<option value="${esc(f.name)}">${esc(f.label || fontLabel(f.file))}</option>`).join('');
      sel.innerHTML = opts;
      // Prefer Dyslex-Kriyah as default when available
      if (dyslex && (P().font === 'Rubik' || P().font === DYSLEX_FONT || !fonts.some(f => f.name === P().font))) {
        profiles.R.font = dyslex.name;
        profiles.L.font = dyslex.name;
      }
      sel.value = P().font;
    }
    setStatus('status-fonts', `${fonts.length} font(s) loaded`, fonts.length > 0);
  }
  return loaded > 0;
}

async function tryAutoRoots() {
  const candidates = [
    './rootcvs/Tanakh Root Master CSV.csv',
    './rootcvs/Tanakh%20Root%20Master%20CSV.csv'
  ];
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      parseCSV(await res.text());
      setStatus('status-csv', `Root CSV (${rootRows.length} roots)`, true);
      updateCount();
      return true;
    } catch (e) { /* try next */ }
  }
  return false;
}

async function autoReconnect() {
  // Prefer auto-load from bundled folders (no upload needed when served locally)
  const ok = await tryAutoLoad();
  await tryAutoFonts();
  await tryAutoRoots();
  if (ok) return;
  for (const key of Object.keys(FOLDERS)) {
    const h = await idbGet(key); if (!h) continue;
    try {
      if ((await h.queryPermission({ mode: 'read' })) === 'granted') await FOLDERS[key].scan(h);
      else setStatus(FOLDERS[key].st, `Saved: ${h.name}. Click to reconnect`, false);
    } catch (e) { /* ignore */ }
  }
}

/* ───────── Search panels ───────── */
function wordSearch() {
  const q = stripMarks($('word-search-input').value.trim()), out = $('word-search-results');
  if (!q) { out.innerHTML = ''; return; }
  const hits = [...new Set($('text-viewer').innerText.split(/\s+/).filter(w => stripMarks(w).includes(q)))].slice(0, 20);
  out.innerHTML = hits.map(h => `<div>${esc(h)}</div>`).join('') || '<div style="color:var(--muted)">No matches</div>';
}
function rootSearch() {
  const q = normRoot($('root-search-input').value.trim()), out = $('root-search-results');
  if (!q) { out.innerHTML = ''; return; }
  const m = rootRows.filter(r => r.root === q);
  out.innerHTML = m.map(r => `<div data-r="${r.root}" title="Click to highlight this root in the text"><strong>${esc(r.root)}</strong> · ${esc(r.occ)} occurrences<br><small>${esc(r.ex)}</small></div>`).join('')
    || `<div style="color:var(--muted)">${rootRows.length ? 'No root data for this root' : 'Load the Root CSV first'}</div>`;
}

/* ───────── Init ───────── */
function init() {
  initPicker();
  panel('nk-strip', 'nk-panel', 'nk-chev'); panel('sh-strip', 'sh-panel', 'sh-chev'); panel('tp-strip', 'tp-panel', 'tp-chev');
  // Only one of Niqqud / Shoresh / Trope highlighting can be on at a time
  $('nk-on').onchange = e => setHighlight('nk', e.target.checked);
  $('sh-on').onchange = e => setHighlight('sh', e.target.checked);
  $('tp-on').onchange = e => setHighlight('tp', e.target.checked);
  $('nk-all-on').onclick = () => setAll(true); $('nk-all-off').onclick = () => setAll(false);
  if ($('tp-all-on')) $('tp-all-on').onclick = () => setAllTropes(true);
  if ($('tp-all-off')) $('tp-all-off').onclick = () => setAllTropes(false);
  seg('nk-mode', m => { P().nk.mode = m; applyStyles(); });
  seg('sh-mode', m => { P().sh.mode = m; applyStyles(); });
  seg('tp-mode', m => { P().tp.mode = m; applyStyles(); });
  $('nk-op').oninput = e => { P().nk.op = +e.target.value; $('nk-op-val').textContent = e.target.value + '%'; applyStylesSoon(); };
  $('sh-op').oninput = e => { P().sh.op = +e.target.value; $('sh-op-val').textContent = e.target.value + '%'; applyStylesSoon(); };
  $('tp-op').oninput = e => { P().tp.op = +e.target.value; $('tp-op-val').textContent = e.target.value + '%'; applyStylesSoon(); };

  // Shoresh search: typing a root turns the highlight on and marks it in the active column only.
  // Each tikkun column has its own independent root / colour / mode.
  // Debounced so large perakim stay snappy while you type.
  const debouncedRootUpdate = debounce(() => {
    updateCount();
    applyStyles();
  }, 120);
  const debouncedShSuggest = debounce(q => renderShSuggest(q), 80);
  $('sh-root').oninput = e => {
    const p = P(); p.sh.root = e.target.value;
    if (e.target.value.trim() && !p.sh.on) setHighlight('sh', true);
    debouncedRootUpdate();
    debouncedShSuggest(e.target.value);
  };
  $('sh-root').onkeydown = e => {
    const box = $('sh-suggest');
    if (!box || box.hidden) {
      if (e.key === 'Escape') closeShSuggest();
      return;
    }
    const items = [...box.querySelectorAll('.sh-suggest-item')];
    if (!items.length) {
      if (e.key === 'Escape') closeShSuggest();
      return;
    }
    let i = items.findIndex(el => el.classList.contains('active'));
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (i >= 0) items[i].classList.remove('active');
      i = (i + 1) % items.length;
      items[i].classList.add('active');
      items[i].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (i >= 0) items[i].classList.remove('active');
      i = (i - 1 + items.length) % items.length;
      items[i].classList.add('active');
      items[i].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = items[i >= 0 ? i : 0];
      if (pick) pickShSuggest(pick.dataset.r);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeShSuggest();
    }
  };
  $('sh-root').onblur = () => {
    // Delay so a click on a suggestion still registers
    setTimeout(closeShSuggest, 150);
  };
  $('sh-suggest').onmousedown = e => {
    // Prevent input blur from firing before click
    e.preventDefault();
    const item = e.target.closest('.sh-suggest-item');
    if (item && item.dataset.r) pickShSuggest(item.dataset.r);
  };
  $('root-search-results').onclick = e => {
    const d = e.target.closest('[data-r]'); if (!d) return;
    P().sh.root = d.dataset.r; setHighlight('sh', true);
    loadControls(); // refreshes the input + re-applies highlight for the active side
  };

  $('ls').oninput = e => { P().ls = +e.target.value; $('ls-val').textContent = e.target.value + 'px'; applyStylesSoon(); };
  $('font-picker').onchange = e => {
    P().font = e.target.value;
    // Rebuild HTML so overlay layers are fresh for the new face (verifyOverlays
    // may have stripped .top on the previous font).
    _wordCache.clear();
    _textHtmlCache.clear();
    applyStyles();
    render();
  };
  const setSize = v => {
    let n = parseFloat(String(v).replace(',', '.'));
    if (!isFinite(n)) n = P().fs;
    P().fs = Math.min(200, Math.max(6, Math.round(n * 2) / 2)); $('fs').value = P().fs; applyStyles();
  };
  $('fs').onchange = e => setSize(e.target.value);
  $('fs').onkeydown = e => { if (e.key === 'Enter') { setSize(e.target.value); e.target.blur(); } };
  $('fs-minus').onclick = () => setSize(P().fs - 1); $('fs-plus').onclick = () => setSize(P().fs + 1);

  // Tikkun: two columns, each with its own full settings profile (niqqud, shoresh, trope, font, size, content)
  $('btn-tikkun').onclick = () => {
    tikkun = !tikkun; $('side-card').style.display = tikkun ? '' : 'none';
    if (!tikkun) side = 'R';
    $('btn-tikkun').textContent = tikkun ? '📖 Back to single column' : '📖 Two-column Tikkun layout';
    loadControls(); render();
  };
  // Switching the active column loads that column’s independent settings into the sidebar
  seg('side-seg', m => { side = m; loadControls(); });
  // Content mode (full niqqud vs letters-only) is also per-column
  seg('content-seg', m => { P().content = m; render(); });
  $('side-copy').onclick = () => {
    const o = side === 'R' ? 'L' : 'R';
    const c = structuredClone(P());
    // Keep the other column’s content mode (stam vs full) so you can still mix them
    c.content = profiles[o].content;
    profiles[o] = c;
    render();
  };

  [['roots', 'btn-csv', 'chg-roots'], ['fonts', 'btn-fonts', 'chg-fonts']].forEach(([k, b, c]) => {
    const btn = $(b), chg = $(c);
    if (btn) btn.onclick = guard(() => openFolder(k));
    if (chg) chg.onclick = guard(() => openFolder(k, true));
  });
  window.addEventListener('beforeprint', () => { if (_pendingFlush) _pendingFlush(); });
  // After print: drop back to the locked preview so the on-screen view never stays "fully loaded"
  window.addEventListener('afterprint', () => {
    if (_restorePreviewAfterPrint) {
      _restorePreviewAfterPrint = false;
      _pendingFlush = null;
      render();
    }
  });
  // Re-fit Vilna dafim when the window is resized
  let _vilnaResizeTimer = null;
  window.addEventListener('resize', () => {
    if (!showVilna || corpus !== 'gemara') return;
    clearTimeout(_vilnaResizeTimer);
    _vilnaResizeTimer = setTimeout(() => {
      const v = $('text-viewer');
      if (v && typeof VilnaGemara !== 'undefined' && typeof VilnaGemara.fitToWidth === 'function') {
        v.querySelectorAll('.vilna-daf').forEach(VilnaGemara.fitToWidth);
      }
    }, 120);
  });
  $('btn-print').onclick = () => window.print();
  // Load Full Preview = same as Print / Ctrl+P (no separate "load into preview" step)
  const fullPrev = $('btn-full-preview');
  if (fullPrev) fullPrev.onclick = () => window.print();
  // Word & root search slides in only when needed — page stays full width
  const util = $('utility');
  const toggleTools = open => {
    if (open === undefined) open = !util.classList.contains('open');
    util.classList.toggle('open', open);
    util.hidden = !open;
  };
  if ($('btn-tools')) $('btn-tools').onclick = () => toggleTools();
  if ($('btn-tools-close')) $('btn-tools-close').onclick = () => toggleTools(false);
  $('tabs').onclick = e => {
    const tab = e.target.closest('.tab'); if (!tab || tab.disabled) return;
    corpus = tab.dataset.c;
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === tab));
    chapters = [];
    rashiChapters = null;
    translationChapters = null;
    pasukRange = null; siddurSel = new Set();
    if ($('range-from')) $('range-from').value = '';
    if ($('range-to')) $('range-to').value = '';
    if ($('pasuk-range')) $('pasuk-range').value = '';
    if ($('opt-translation')) { $('opt-translation').checked = false; }
    if ($('opt-rashi')) { $('opt-rashi').checked = false; }
    if ($('opt-rashi-en')) { $('opt-rashi-en').checked = false; }
    if ($('opt-tosafot')) { $('opt-tosafot').checked = false; }
    showTranslation = false; showRashi = false; showRashiEn = false; showTosafot = false; /* showVilna persists */
    rashiEnChapters = null; tosafotChapters = null;
    const chapSel = $('select-chapter');
    if (chapSel) chapSel.innerHTML = '<option value="">Chapter</option>';
    updateTanachToolsVisibility();
    fillSections();
    // fillBooks (via fillSections) calls render() to clear stale text
  };
  $('select-category').onchange = fillBooks; $('select-title').onchange = openBook;
  $('select-chapter').onchange = onChapterChange;

  // Tanach range + Translation / Rashi
  const applyRange = guard(async () => {
    const hasInput = ($('range-from') && $('range-from').value.trim()) || ($('range-to') && $('range-to').value.trim());
    pasukRange = parseRangeFromBoxes();
    if (hasInput && !pasukRange) {
      toast('Use From / To like 1:14 and 6:20 (inclusive)', 'warn');
      return;
    }
    if (pasukRange && chapters.length) {
      const err = rangeBoundsError(pasukRange, chapters);
      if (err) {
        toast(err, 'warn');
        return;
      }
    }
    await applyTanachOptions();
  });
  if ($('btn-range-apply')) $('btn-range-apply').onclick = applyRange;
  ['range-from', 'range-to', 'pasuk-range'].forEach(id => {
    const el = $(id);
    if (el) el.onkeydown = e => { if (e.key === 'Enter') applyRange(); };
  });
  if ($('btn-range-clear')) $('btn-range-clear').onclick = guard(async () => {
    if ($('range-from')) {
      $('range-from').value = '';
      $('range-from').disabled = false;
    }
    if ($('range-to')) {
      $('range-to').value = '';
      $('range-to').disabled = false;
    }
    if ($('pasuk-range')) $('pasuk-range').value = '';
    pasukRange = null;
    // Re-enable in case a prior lock left the button stuck
    const clearBtn = $('btn-range-clear');
    if (clearBtn) {
      clearBtn.disabled = false;
      clearBtn.removeAttribute('disabled');
    }
    const goBtn = $('btn-range-apply');
    if (goBtn) {
      goBtn.disabled = false;
      goBtn.removeAttribute('disabled');
    }
    // Also clear the text on the page — unload book / chapters and show empty state
    chapters = [];
    rashiChapters = null;
    translationChapters = null;
    rashiEnChapters = null;
    tosafotChapters = null;
    siddurSel = new Set();
    if ($('opt-translation')) { $('opt-translation').checked = false; showTranslation = false; }
    if ($('opt-rashi')) { $('opt-rashi').checked = false; showRashi = false; }
    if ($('opt-rashi-en')) { $('opt-rashi-en').checked = false; showRashiEn = false; }
    if ($('opt-tosafot')) { $('opt-tosafot').checked = false; showTosafot = false; }
    const titleSel = $('select-title');
    if (titleSel) titleSel.value = '';
    const chapSel = $('select-chapter');
    if (chapSel) chapSel.innerHTML = '<option value="">Chapter</option>';
    buildSiddurPicker();
    updateChapterUI();
    updateTanachToolsVisibility();
    render();
    toast('Page cleared', 'ok');
  });
  if ($('opt-translation')) $('opt-translation').onchange = guard(async e => {
    showTranslation = e.target.checked;
    await applyTanachOptions();
  });
  if ($('opt-rashi')) $('opt-rashi').onchange = guard(async e => {
    showRashi = e.target.checked;
    if (!showRashi && $('opt-rashi-en')) {
      $('opt-rashi-en').checked = false;
      showRashiEn = false;
    }
    await applyTanachOptions();
  });
  if ($('opt-rashi-en')) $('opt-rashi-en').onchange = guard(async e => {
    showRashiEn = e.target.checked;
    if (showRashiEn && !showRashi) {
      showRashi = true;
      if ($('opt-rashi')) $('opt-rashi').checked = true;
    }
    await applyTanachOptions();
  });
  if ($('opt-tosafot')) $('opt-tosafot').onchange = guard(async e => {
    showTosafot = e.target.checked;
    await applyTanachOptions();
  });
  if ($('opt-vilna')) $('opt-vilna').onchange = e => {
    showVilna = e.target.checked;
    updateTanachToolsVisibility();
    // Chapters may have been built as placeholders (verses: ['']) for Vilna;
    // re-open the book so non-Vilna gets real text (or Vilna gets labels).
    const titleSel = $('select-title');
    if (titleSel && titleSel.value !== '') openBook();
    else render();
  };
  if ($('opt-pdf-breaks')) $('opt-pdf-breaks').onchange = e => {
    showPdfBreaks = e.target.checked;
    markPdfPageBreaks();
  };
  if ($('opt-line-break')) $('opt-line-break').onchange = e => {
    lineBreakPostPasuk = e.target.checked;
    render();
  };
  if ($('opt-edit')) $('opt-edit').onchange = e => {
    const v = $('text-viewer');
    if (v) v.contentEditable = e.target.checked ? 'true' : 'false';
  };

  $('ch-prev').onclick = () => stepChapter(-1); $('ch-next').onclick = () => stepChapter(1);
  $('word-search-input').oninput = debounce(wordSearch, 180);
  $('root-search-input').oninput = debounce(rootSearch, 120);
  // Siddur section checkboxes
  $('siddur-list').onchange = e => {
    const cb = e.target.closest('input[data-i]'); if (!cb) return;
    cb.checked ? siddurSel.add(+cb.dataset.i) : siddurSel.delete(+cb.dataset.i);
    updateSiddurCount(); render();
  };
  $('siddur-all').onclick = () => { chapters.forEach((_, i) => siddurSel.add(i)); buildSiddurPicker(); render(); };
  $('siddur-none').onclick = () => { siddurSel.clear(); buildSiddurPicker(); render(); };
  document.addEventListener('click', e => { const d = $('siddur-picker'); if (d && d.open && !d.contains(e.target)) d.open = false; });
  // Sync checkbox UI to JS defaults
  if ($('opt-vilna')) $('opt-vilna').checked = showVilna;
  if ($('opt-pdf-breaks')) $('opt-pdf-breaks').checked = showPdfBreaks;
  if ($('opt-line-break')) $('opt-line-break').checked = lineBreakPostPasuk;
  if ($('opt-translation')) $('opt-translation').checked = showTranslation;
  if ($('opt-rashi')) $('opt-rashi').checked = showRashi;
  if ($('opt-rashi-en')) $('opt-rashi-en').checked = showRashiEn;
  if ($('opt-tosafot')) $('opt-tosafot').checked = showTosafot;
  updateTanachToolsVisibility(); updateChapterUI();
  loadControls(); render(); autoReconnect();
}
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);
