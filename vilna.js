// Vilna-Shas-style daf layout from local Sefaria JSON (no network).
//
// How this version works (vs. the old character-budget version):
//   1. Sefaria HTML is parsed into styled word tokens (dibbur hamatchil <b> is preserved).
//   2. Every word is MEASURED in real pixels with the real fonts (canvas measureText).
//   3. Paragraphs are broken with a total-fit (Knuth–Plass-style) optimizer, not greedy.
//   4. The page is built by a height-based "sweep": each region lasts until the first
//      active stream runs out; then the remaining streams reflow into the freed space.
//   5. The Gemara column width is searched so the 3-column hourglass body is as tall
//      as possible.
//   6. Every line is emitted explicitly and justified with exact word-spacing, so what
//      was computed is exactly what is drawn.
//   7. Column sides flip per amud: Rashi is always on the INNER margin, Tosafot OUTER.

(function (global) {
  'use strict';

  /* ───────────────────────── Config ───────────────────────── */
  const DEFAULTS = {
    pageWidth: 940,          // design width in px (use fitToWidth() to scale to a container)
    gap: 14,                 // gutter between columns
    topBandLines: 4,         // wide Rashi|Tosafot lines above the Gemara (0 = off)
    /**
     * Hourglass: the Gemara is wide at the top ("shoulders"), pinched to a narrow waist in
     * the middle where Rashi + Tosafot bulge inward, then wide again for its last lines
     * before the commentaries wrap beneath it. top/bottom = Gemara lines set at the wide width.
     */
    hourglass: { on: true, top: 5, bottom: 5, wide: 1.28, minSide: 0.9 },
    /** Dibbur hamatchil of Rashi/Tosafot is set in SQUARE letters (the Gemara face), like a real daf. */
    dh: { square: true, scale: 1.0, weight: 700 },
    paper: true,            // ivory page tone + thin frame (adds class "vilna-paper")
    preferredFraction: 0.38, // Gemara column as a share of page width
    fractions: null,         // null = search 0.28…0.52; or pass e.g. [0.4] to pin it
    orphanPx: 40,            // leftover this short (≈1–2 lines) is absorbed, not given its own region
    safety: 1.5,             // px shaved off each measured line width
    stripNikud: true,
    /** Strip Sefaria quotes, dashes, and common punctuation from tokens (layout + display). */
    ignorePunct: true,
    /**
     * Approximate Hebrew characters-per-line budgets (per role), INCLUDING spaces.
     * short / normal / wide size the side columns, the 3-col Gemara body, and expanded
     * Gemara when a side empties. Override from the app to tune density.
     *
     * Medium targets (with spaces):
     *   Gemara / Mishnah  ~40–48
     *   Rashi / Tosfos    ~52–65
     */
    chars: {
      gemara:  { short: 32, normal: 44, wide: 56 },
      comment: { short: 50, normal: 58, wide: 72 },
    },
    fonts: {
      gemara:  { family: '"Frank Ruhl Libre","Noto Serif Hebrew","Times New Roman",serif', size: 20, lineHeight: 28, weight: 400, boldWeight: 700, bigScale: 1.3 },
      comment: { family: '"Noto Rashi Hebrew","Frank Ruhl Libre","Times New Roman",serif', size: 15, lineHeight: 19, weight: 400, boldWeight: 700, bigScale: 1.35 },
    },
    // Optional: (text, cssFontString) => px. Default uses a canvas. Inject for tests/workers.
    measureText: null,
  };

  /** Characters treated as ignorable Sefaria noise (quotes, dashes, light punctuation). */
  const PUNCT_RE = /["""''״׳`´«»–—‒―−\-‐‑.,;:!?()[\]{}…·•]/g;

  const config = clone(DEFAULTS);
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function mergeCfg(opts) {
    const c = clone(config);
    opts = opts || {};
    Object.keys(opts).forEach((k) => {
      if (k === 'fonts') {
        ['gemara', 'comment'].forEach((r) => { if (opts.fonts && opts.fonts[r]) Object.assign(c.fonts[r], opts.fonts[r]); });
      } else if (k === 'chars' && opts.chars) {
        // Support both nested { gemara, comment } and flat { short, normal, wide } (legacy).
        c.chars = c.chars || {};
        if (opts.chars.gemara || opts.chars.comment) {
          if (opts.chars.gemara) c.chars.gemara = Object.assign({}, c.chars.gemara || {}, opts.chars.gemara);
          if (opts.chars.comment) c.chars.comment = Object.assign({}, c.chars.comment || {}, opts.chars.comment);
        } else {
          // Flat → apply to both roles for back-compat
          c.chars.gemara = Object.assign({}, c.chars.gemara || {}, opts.chars);
          c.chars.comment = Object.assign({}, c.chars.comment || {}, opts.chars);
        }
      } else c[k] = opts[k];
    });
    return c;
  }

  /* ───────────────────────── Hebrew helpers ───────────────────────── */
  const MAS_HE = {
    Berakhot: 'ברכות', Shabbat: 'שבת', Eruvin: 'עירובין', Pesachim: 'פסחים', 'Rosh Hashanah': 'ראש השנה',
    Yoma: 'יומא', Sukkah: 'סוכה', Beitzah: 'ביצה', Taanit: 'תענית', Megillah: 'מגילה', 'Moed Katan': 'מועד קטן',
    Chagigah: 'חגיגה', Yevamot: 'יבמות', Ketubot: 'כתובות', Nedarim: 'נדרים', Nazir: 'נזיר', Sotah: 'סוטה',
    Gittin: 'גיטין', Kiddushin: 'קידושין', 'Bava Kamma': 'בבא קמא', 'Bava Metzia': 'בבא מציעא', 'Bava Batra': 'בבא בתרא',
    Sanhedrin: 'סנהדרין', Makkot: 'מכות', Shevuot: 'שבועות', 'Avodah Zarah': 'עבודה זרה', Horayot: 'הוריות',
    Zevachim: 'זבחים', Menachot: 'מנחות', Chullin: 'חולין', Bekhorot: 'בכורות', Arakhin: 'ערכין', Temurah: 'תמורה',
    Keritot: 'כריתות', Meilah: 'מעילה', Tamid: 'תמיד', Niddah: 'נדה',
  };

  function hebNum(n) {
    const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
    const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
    const hund = ['', 'ק', 'ר', 'ש'];
    let s = '';
    while (n >= 400) { s += 'ת'; n -= 400; }
    s += hund[Math.floor(n / 100)]; n %= 100;
    if (n === 15) s += 'טו'; else if (n === 16) s += 'טז';
    else s += tens[Math.floor(n / 10)] + ones[n % 10];
    return s;
  }

  function hebrewDafTitle(book, dafLabel) {
    const m = String(dafLabel).match(/^(\d+)([ab])$/i);
    const mas = MAS_HE[book] || book;
    if (!m) return { masechet: mas, daf: dafLabel };
    return { masechet: mas, daf: 'דף ' + hebNum(+m[1]) + ' ע״' + (m[2].toLowerCase() === 'a' ? 'א' : 'ב') };
  }

  /* ───────────────────────── Text parsing ───────────────────────── */
  const NIKUD_ALL = /[\u0591-\u05C7]/g;
  const NIKUD_LIGHT = /[\u0591-\u05AF\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5]/g;
  const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'wbr']);

  function decodeEntities(s) {
    return s.replace(/&(nbsp|thinsp|amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (m, e) => {
      e = e.toLowerCase();
      if (e === 'nbsp' || e === 'thinsp') return ' ';
      if (e === 'amp') return '&'; if (e === 'lt') return '<'; if (e === 'gt') return '>';
      if (e === 'quot') return '"'; if (e === 'apos') return "'";
      if (e[1] === 'x') return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (e[0] === '#') { const n = parseInt(e.slice(1), 10); return n === 160 ? ' ' : String.fromCodePoint(n); }
      return m;
    });
  }

  /** Plain-text normalizer (kept for backwards compatibility). */
  function stripHtml(s) {
    return decodeEntities(String(s || '').replace(/<[^>]+>/g, ''))
      .replace(/[\u200f\u200e\ufeff]/g, '').replace(NIKUD_LIGHT, '').replace(/\s+/g, ' ').trim();
  }
  const normalizeText = stripHtml;

  /**
   * Sefaria HTML → word tokens {t, b, big}. Keeps <b>/<strong> (dibbur hamatchil) and
   * <big> (מתני׳ / גמ׳ labels); drops footnotes; <br> becomes a space.
   */
  function parseRich(html, cfg) {
    const out = [];
    const nik = cfg && cfg.stripNikud === false ? null : NIKUD_ALL;
    const dropPunct = !cfg || cfg.ignorePunct !== false;
    let bold = 0, big = 0, skip = 0, endsSpace = true;
    const stack = [];
    const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)/g;
    let m;
    while ((m = re.exec(String(html || '')))) {
      if (m[2]) {
        const name = m[2].toLowerCase();
        if (name === 'br') { endsSpace = true; continue; }
        if (VOID_TAGS.has(name)) continue;
        if (!m[1]) {
          const e = {
            name,
            b: name === 'b' || name === 'strong' ? 1 : 0,
            big: name === 'big' ? 1 : 0,
            skip: /footnote/i.test(m[3]) && /^(i|sup|span)$/.test(name) ? 1 : 0,
          };
          bold += e.b; big += e.big; skip += e.skip; stack.push(e);
        } else {
          for (let k = stack.length - 1; k >= 0; k--) {
            if (stack[k].name === name) {
              stack.splice(k).forEach((e) => { bold -= e.b; big -= e.big; skip -= e.skip; });
              break;
            }
          }
        }
        continue;
      }
      if (skip > 0) continue;
      let text = decodeEntities(m[4]).replace(/[\u200f\u200e\ufeff]/g, '');
      if (nik) text = text.replace(nik, '');
      if (dropPunct) text = text.replace(PUNCT_RE, '');
      if (!text) continue;
      const startsSpace = /^\s/.test(text);
      const words = text.split(/\s+/).filter(Boolean);
      words.forEach((w, i) => {
        // After punct strip, skip empty / pure-space leftovers
        if (!w) return;
        // glue word fragments that touch the previous tag: <b>מאימתי</b>.
        if (i === 0 && !startsSpace && !endsSpace && out.length) out[out.length - 1].t += w;
        else out.push({ t: w, b: bold > 0 ? 1 : 0, big: big > 0 ? 1 : 0 });
      });
      endsSpace = /\s$/.test(text);
    }
    out.forEach((tk) => { if (/^(מתני|גמ)[׳']?$/.test(tk.t)) { tk.b = 1; tk.big = 1; } });
    return out;
  }

  /** Fallback when the source has no <b>: bold up to the first " – " / "." / "וכו׳". */
  function guessDibbur(tokens) {
    const lim = Math.min(tokens.length, 9);
    for (let i = 0; i < lim; i++) {
      const t = tokens[i].t;
      if (/^[–—‒-]$/.test(t)) { for (let k = 0; k < i; k++) tokens[k].b = 1; return; }
      if (/[.:]$/.test(t) || /וכו[׳']$/.test(t)) { for (let k = 0; k <= i; k++) tokens[k].b = 1; return; }
    }
  }

  /**
   * Mark dibbur hamatchil with <b> on the raw string BEFORE punct stripping.
   * Local JSON is plain text (no <b>); ignorePunct removes the dashes/periods
   * that guessDibbur needs — so we tag the lemma up front.
   */
  function markDibburHtml(html) {
    const s = String(html || '');
    if (!s || /<b[\s>]|<strong[\s>]/i.test(s)) return s; // already marked
    // Prefer dash separator (en/em/ascii)
    const dash = s.match(/^([\s\S]{1,100}?)(\s*[–—‒−‐‑-]\s+)([\s\S]*)$/);
    if (dash && dash[1].trim()) {
      let left = dash[1];
      const parts = left.split(/(?<=[.:])\s+/).filter(Boolean);
      if (parts.length > 1 && parts[parts.length - 1].length <= 60) {
        const head = parts.slice(0, -1).join(' ');
        const dh = parts[parts.length - 1];
        return head + ' <b>' + dh + '</b>' + dash[2] + dash[3];
      }
      return '<b>' + left + '</b>' + dash[2] + dash[3];
    }
    // Short opening phrase ending in . or :
    const dot = s.match(/^(.{2,55}?[.:])(\s+)([\s\S]{8,})$/);
    if (dot) return '<b>' + dot[1] + '</b>' + dot[2] + dot[3];
    // וכו׳ form
    const vku = s.match(/^(.{2,55}?וכו[׳']?)(\s+)([\s\S]+)$/);
    if (vku) return '<b>' + vku[1] + '</b>' + vku[2] + vku[3];
    return s;
  }

  function flatStrings(cell) {
    if (cell == null || cell === '') return [];
    if (typeof cell === 'string') return cell.trim() ? [cell] : [];
    if (Array.isArray(cell)) return cell.flatMap(flatStrings);
    return [];
  }

  /* ───────────────────────── Measuring ───────────────────────── */
  function fontString(f, bold, big) {
    return (bold ? f.boldWeight : f.weight) + ' ' + (f.size * (big ? f.bigScale : 1)) + 'px ' + f.family;
  }

  function makeMeasure(cfg) {
    if (typeof cfg.measureText === 'function') return cfg.measureText;
    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (!canvas) throw new Error('No canvas available: pass options.measureText(text, cssFont)');
    const ctx = canvas.getContext('2d');
    const cache = new Map();
    return function (text, font) {
      const k = font + '|' + text;
      let w = cache.get(k);
      if (w === undefined) { ctx.font = font; w = ctx.measureText(text).width; cache.set(k, w); }
      return w;
    };
  }

  async function ensureFonts(cfg) {
    if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) return;
    const jobs = [];
    ['gemara', 'comment'].forEach((r) => {
      const f = cfg.fonts[r];
      jobs.push(document.fonts.load(fontString(f, false), 'אבג').catch(() => {}));
      jobs.push(document.fonts.load(fontString(f, true), 'אבג').catch(() => {}));
    });
    // DH in commentary uses the square (Gemara) family
    const g = cfg.fonts.gemara, c = cfg.fonts.comment;
    jobs.push(document.fonts.load((cfg.dh && cfg.dh.weight || 700) + ' ' + c.size + 'px ' + g.family, 'אבג').catch(() => {}));
    await Promise.all(jobs);
    try { await document.fonts.ready; } catch (e) { /* ignore */ }
  }

  /** Font used to MEASURE a token — must match what the CSS paints (see injectStyle). */
  function tokenFont(cfg, role, tk) {
    const f = cfg.fonts[role];
    if (role === 'comment' && cfg.dh && cfg.dh.square && (tk.b || tk.big)) {
      const scale = (cfg.dh.scale || 1) * (tk.big ? f.bigScale : 1);
      return (cfg.dh.weight || f.boldWeight) + ' ' + (f.size * scale) + 'px ' + cfg.fonts.gemara.family;
    }
    return fontString(f, tk.b || tk.big || tk.mish, tk.big);
  }

  function measureTokens(tokens, role, cfg, measure) {
    const f = cfg.fonts[role];
    tokens.forEach((tk) => { tk.w = measure(tk.t, tokenFont(cfg, role, tk)); });
    return measure(' ', fontString(f, false));
  }

  /* ───────────────────────── Line breaking (total fit) ───────────────────────── */
  const LINE_PEN = 0.002;

  /**
   * Optimal breaks for tokens[start..]: minimizes Σ(slack/width)² so lines fill evenly
   * (greedy leaves ragged/gappy lines). The final line is free. No hyphenation.
   */
  function breakLines(tokens, start, width, space) {
    const n = tokens.length - start;
    if (n <= 0) return [];
    const best = new Float64Array(n + 1).fill(Infinity);
    const from = new Int32Array(n + 1);
    best[0] = 0;
    for (let i = 0; i < n; i++) {
      if (best[i] === Infinity) continue;
      let len = 0;
      for (let j = i; j < n; j++) {
        len += tokens[start + j].w + (j > i ? space : 0);
        if (len > width && j > i) break;
        let cost;
        if (len > width) cost = 1e4;                 // lone over-long word: allowed, penalized
        else if (j === n - 1) cost = 0;              // paragraph's last line
        else { const r = (width - len) / width; cost = r * r + LINE_PEN; }
        if (best[i] + cost < best[j + 1]) { best[j + 1] = best[i] + cost; from[j + 1] = i; }
      }
    }
    const lines = [];
    for (let e = n; e > 0; e = from[e]) {
      const s = from[e];
      let nat = 0;
      for (let k = s; k < e; k++) nat += tokens[start + k].w;
      nat += (e - s - 1) * space;
      lines.push({ i0: start + s, i1: start + e, natural: nat, ragged: false });
    }
    return lines.reverse();
  }

  /** A stream (Gemara / Rashi / Tosafot) with a read position and cached wraps. */
  function Cursor(tokens, space, lh, safety) {
    this.tokens = tokens; this.space = space; this.lh = lh; this.safety = safety;
    this.pos = 0; this.cache = new Map();
  }
  Cursor.prototype.reset = function () { this.pos = 0; };
  Cursor.prototype.done = function () { return this.pos >= this.tokens.length; };
  Cursor.prototype.linesAt = function (width) {
    const k = this.pos + '|' + Math.round(width * 10);
    let ls = this.cache.get(k);
    if (!ls) { ls = breakLines(this.tokens, this.pos, width - this.safety, this.space); this.cache.set(k, ls); }
    return ls;
  };
  Cursor.prototype.take = function (width, n) {
    const ls = this.linesAt(width);
    const k = Math.max(1, Math.min(n, ls.length));
    const taken = ls.slice(0, k).map((l) => Object.assign({}, l));
    if (k === ls.length) taken[k - 1].ragged = true;
    this.pos = ls[k - 1].i1;
    return taken;
  };

  /** Back-compat: wrap plain text with a char budget (no longer used by the layout). */
  function wrapText(text, maxChars) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = []; let cur = '';
    words.forEach((w) => {
      if (!cur) cur = w;
      else if (cur.length + 1 + w.length <= maxChars) cur += ' ' + w;
      else { lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    return lines;
  }

  /* ───────────────────────── Page planner ───────────────────────── */
  /**
   * Blocks are positioned in INNER→OUTER coordinates (0 = inner margin edge), so the
   * same plan renders correctly for either amud.
   */
  function blocksFor(active, gw, sw, P, gap) {
    const hw = (P - gap) / 2;
    const { g, r, t } = active;
    if (g && r && t) return { type: 'three', blocks: [
      { role: 'rashi', from: 0, width: sw },
      { role: 'gemara', from: sw + gap, width: gw },
      { role: 'tosafot', from: P - sw, width: sw }] };
    if (g && t) return { type: 'gemara-tosafot', blocks: [
      { role: 'gemara', from: 0, width: P - sw - gap },
      { role: 'tosafot', from: P - sw, width: sw }] };
    if (g && r) return { type: 'gemara-rashi', blocks: [
      { role: 'rashi', from: 0, width: sw },
      { role: 'gemara', from: sw + gap, width: P - sw - gap }] };
    if (r && t) return { type: 'half', blocks: [
      { role: 'rashi', from: 0, width: hw },
      { role: 'tosafot', from: P - hw, width: hw }] };
    const role = g ? 'gemara' : r ? 'rashi' : 'tosafot';
    return { type: 'full', blocks: [{ role, from: 0, width: P }] };
  }

  const KEY = { gemara: 'g', rashi: 'r', tosafot: 't' };

  function planLayout(cur, P, cfg, f) {
    const gap = cfg.gap;
    const gw = Math.round(P * f);
    const sw = (P - gw - 2 * gap) / 2;
    const hw = (P - gap) / 2;
    const regions = [];
    Object.keys(cur).forEach((k) => cur[k].reset());

    const lhOf = (role) => cur[KEY[role]].lh;
    const emit = (type, blocks, takes) => {
      let h = 0;
      blocks.forEach((b, i) => {
        b.lines = takes[i]; b.lh = lhOf(b.role);
        h = Math.max(h, b.lines.length * b.lh);
      });
      regions.push({ type, h, blocks });
    };

    // Optional wide band: first few Rashi|Tosafot lines run across the top.
    if (cfg.topBandLines > 0 && !cur.r.done() && !cur.t.done()) {
      const n = Math.min(cfg.topBandLines, cur.r.linesAt(hw).length, cur.t.linesAt(hw).length);
      const blocks = [{ role: 'rashi', from: 0, width: hw }, { role: 'tosafot', from: P - hw, width: hw }];
      emit('top', blocks, [cur.r.take(hw, n), cur.t.take(hw, n)]);
    }

    // ── Hourglass geometry: wide "shoulder" Gemara, narrow "waist" Gemara ──
    const hg = cfg.hourglass || {};
    // With the Rashi|Tosafot band on top, the Gemara starts at its waist width (no top shoulder).
    const topLines = cfg.topBandLines > 0 ? 0 : Math.max(0, hg.top == null ? 5 : hg.top);
    const botLines = Math.max(0, hg.bottom == null ? 5 : hg.bottom);
    // Shoulders widen the Gemara, but Rashi/Tosafot must not get so narrow that a line holds only
    // 3-4 words (justified spaces blow up). Side columns keep at least `minSide` x their waist width.
    const gwRaw = Math.min(Math.round(gw * (hg.wide || 1.28)), Math.round(P * 0.68));
    const swW = Math.max((P - gwRaw - 2 * gap) / 2, sw * (hg.minSide || 0.9));
    const gwW = Math.round(P - 2 * gap - 2 * swW);
    // Only pinch the page when the Gemara is long enough to have shoulders AND a waist.
    const hgOn = hg.on !== false && gwW > gw + 8 && cur.g.linesAt(gwW).length >= topLines + botLines + 6;
    let phase = topLines > 0 ? 'top' : 'waist'; // top shoulder → waist → bottom shoulder

    // Sweep: a region lasts until its shortest stream ends; the rest reflows.
    for (let guard = 0; guard < 80; guard++) {
      const active = { g: !cur.g.done(), r: !cur.r.done(), t: !cur.t.done() };
      if (!active.g && !active.r && !active.t) break;

      const three = active.g && active.r && active.t;
      let gW = gw, sW = sw, capG = Infinity;
      if (three && hgOn) {
        if (phase === 'top') { gW = gwW; sW = swW; capG = topLines; }
        else if (phase === 'bottom') { gW = gwW; sW = swW; }
        else {
          // Waist: leave the Gemara's last ~botLines (wide) lines for the bottom shoulder.
          const Lg = cur.g.linesAt(gw).length;
          const reserve = Math.ceil(botLines * gwW / gw);
          if (Lg > reserve + 1) capG = Lg - reserve;
        }
      }

      const { type, blocks } = blocksFor(active, gW, sW, P, gap);
      const availOf = (b) => {
        const c = cur[KEY[b.role]];
        const n = c.linesAt(b.width).length;
        return b.role === 'gemara' ? Math.min(n, capG) : n;
      };
      let h = Infinity;
      blocks.forEach((b) => { h = Math.min(h, availOf(b) * cur[KEY[b.role]].lh); });
      const takes = blocks.map((b) => {
        const c = cur[KEY[b.role]];
        const total = availOf(b);
        let n = Math.round(h / c.lh);
        // absorb orphans: if only ~1-2 lines would spill into a new region, keep them here
        if (total - n > 0 && (total - n) * c.lh <= cfg.orphanPx) n = total;
        return c.take(b.width, n);
      });
      emit(type, blocks, takes);

      if (three && hgOn) {
        if (phase === 'top') phase = 'waist';
        else if (phase === 'waist' && capG < Infinity && !cur.g.done() && !cur.r.done() && !cur.t.done()) phase = 'bottom';
      }
    }

    const H = regions.reduce((s, r) => s + r.h, 0);
    const h3 = regions.reduce((s, r) => s + (r.type === 'three' ? r.h : 0), 0);
    return { regions, H, h3, fraction: f, gemaraWidth: gw, gemaraWideWidth: gwW, sideWidth: sw, hourglass: hgOn };
  }

  function chooseLayout(cur, P, cfg) {
    const both = !cur.r.done() && !cur.t.done() && !cur.g.done();
    const cands = cfg.fractions || (both ? range(0.28, 0.52, 0.02) : [cfg.preferredFraction]);
    let best = null;
    cands.forEach((f) => {
      const p = planLayout(cur, P, cfg, f);
      p.score = p.H ? (p.H - p.h3) / p.H + 0.6 * Math.abs(f - cfg.preferredFraction) : 0;
      if (!best || p.score < best.score) best = p;
    });
    return best;
  }
  function range(a, b, s) { const o = []; for (let x = a; x <= b + 1e-9; x += s) o.push(+x.toFixed(3)); return o; }

  /* ───────────────────────── Streams & public layout ───────────────────────── */
  /**
   * Mishnah is set in heavier type than the Gemara on a real daf. Local text is plain, so the
   * run is found by its labels: מתני׳ … up to the next גמ׳. A run with no closing גמ׳ nearby is
   * ignored (probably a quoted "מתני׳" mid-sugya, not a Mishnah block).
   */
  function markMishnah(tokens) {
    for (let i = 0; i < tokens.length; i++) {
      if (!/^מתני$/.test(tokens[i].t)) continue;
      let end = -1;
      for (let j = i + 1; j < tokens.length && j < i + 400; j++) {
        if (/^גמ$/.test(tokens[j].t)) { end = j; break; }
      }
      if (end < 0) continue;
      for (let k = i + 1; k < end; k++) tokens[k].mish = 1;
      i = end;
    }
  }

  function buildStream(strs, role, cfg, measure, commentary, tosafotFirstBig) {
    let tokens = [];
    strs.forEach((s) => {
      // Tag DH with <b> on the raw string first (works even when ignorePunct strips dashes)
      const raw = commentary ? markDibburHtml(s) : s;
      const t = parseRich(raw, cfg);
      if (commentary && t.length && !t.some((x) => x.b)) guessDibbur(t);
      // Tosafot tradition: enlarge the first word of the dibbur hamatchil
      if (tosafotFirstBig && t.length) {
        const firstB = t.find((x) => x.b);
        if (firstB) firstB.big = 1;
        else { t[0].b = 1; t[0].big = 1; }
      }
      tokens = tokens.concat(t);
    });
    if (!commentary) markMishnah(tokens);
    const space = measureTokens(tokens, role, cfg, measure);
    return new Cursor(tokens, space, cfg.fonts[role].lineHeight, cfg.safety);
  }

  /**
   * Map per-role chars.short / normal / wide → pixel column widths.
   * Uses a short Hebrew sample so the budgets feel like “characters per line”.
   *   Gemara column  ← chars.gemara.normal (body) / .wide (expanded)
   *   Side columns   ← chars.comment.short (3-col) / .normal (half-band)
   */
  function applyCharBudgets(cfg, measure) {
    const ch = cfg.chars || DEFAULTS.chars;
    if (!ch) return cfg;
    const gCh = ch.gemara || ch;
    const cCh = ch.comment || ch;
    const sample = 'מםאבגדהוזחטיכל';
    const gFont = fontString(cfg.fonts.gemara, false, false);
    const cFont = fontString(cfg.fonts.comment, false, false);
    const avgG = measure(sample, gFont) / sample.length;
    const avgC = measure(sample, cFont) / sample.length;
    // Sides use commentary short; Gemara body uses gemara normal
    const sidePx = Math.round((cCh.short || 42) * avgC);
    const gemaraPx = Math.round((gCh.normal || 38) * avgG);
    const gemaraWidePx = Math.round((gCh.wide || 48) * avgG);
    const halfPx = Math.round((cCh.normal || 50) * avgC);
    const gap = cfg.gap || 14;
    // Three-column page: side + gap + gemara + gap + side
    const pageFromChars = sidePx + gap + gemaraPx + gap + sidePx;
    if (!cfg._pageWidthLocked) {
      cfg.pageWidth = Math.max(600, Math.min(1200, pageFromChars));
    }
    // Gemara share of the page
    const f = gemaraPx / (cfg.pageWidth - 2 * gap);
    cfg.preferredFraction = Math.max(0.22, Math.min(0.55, +f.toFixed(3)));
    // Prefer a tight search around the char-derived fraction
    if (!cfg.fractions) {
      const base = cfg.preferredFraction;
      cfg.fractions = [base - 0.04, base - 0.02, base, base + 0.02, base + 0.04]
        .filter((x) => x >= 0.20 && x <= 0.58)
        .map((x) => +x.toFixed(3));
    }
    cfg._charPx = {
      side: sidePx, gemara: gemaraPx, gemaraWide: gemaraWidePx, half: halfPx,
      avgG, avgC,
    };
    return cfg;
  }

  function layoutAmud(amud, options) {
    const cfg = mergeCfg(options);
    if (options && options.pageWidth != null) cfg._pageWidthLocked = true;
    const measure = makeMeasure(cfg);
    applyCharBudgets(cfg, measure);
    const cur = {
      g: buildStream(amud.gemaraStrs, 'gemara', cfg, measure, false),
      r: buildStream(amud.rashiStrs, 'comment', cfg, measure, true, false),
      t: buildStream(amud.tosfosStrs, 'comment', cfg, measure, true, true),
    };
    const plan = chooseLayout(cur, cfg.pageWidth, cfg);
    return {
      ref: amud.ref, book: amud.book, daf: amud.daf, cfg, plan,
      missing: cur.g.tokens.length === 0,
      tokens: { g: cur.g.tokens, r: cur.r.tokens, t: cur.t.tokens },
      hasMishnah: amud.hasMishnah,
    };
  }

  /* ───────────────────────── Rendering ───────────────────────── */
  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  const px = (n) => +n.toFixed(2) + 'px';

  function renderLine(line, tokens, width, bigClassOk) {
    const gaps = line.i1 - line.i0 - 1;
    let ws = 0;
    if (!line.ragged && gaps > 0) ws = Math.max(-0.6, (width - line.natural) / gaps); // exact justification
    const groups = [];
    for (let i = line.i0; i < line.i1; i++) {
      const tk = tokens[i];
      const key = (tk.b ? 'b' : '') + (tk.big ? 'g' : '') + (tk.mish ? 'm' : '');
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.text += ' ' + esc(tk.t);
      else groups.push({ key, text: esc(tk.t) });
    }
    const html = groups.map((g) => {
      if (!g.key) return g.text;
      const cls = g.key.indexOf('g') >= 0 ? 'big' : g.key.indexOf('b') >= 0 ? 'dh' : 'mish';
      return '<span class="' + cls + '">' + g.text + '</span>';
    }).join(' ');
    return '<div class="vl" style="word-spacing:' + px(ws) + '">' + html + '</div>';
  }

  function renderRegion(reg, tokens, innerSide) {
    const blocks = reg.blocks.map((b) => {
      const tk = b.role === 'gemara' ? tokens.g : b.role === 'rashi' ? tokens.r : tokens.t;
      const pos = innerSide === 'right' ? 'right:' + px(b.from) : 'left:' + px(b.from);
      const lines = b.lines.map((l) => renderLine(l, tk, b.width - 0)).join('');
      return '<div class="vb ' + (b.role === 'gemara' ? 'gemara' : 'comm ' + b.role) + '" style="' + pos +
        ';width:' + px(b.width) + '">' + lines + '</div>';
    }).join('');
    return '<div class="vilna-region mode-' + reg.type + '" style="height:' + px(reg.h) + '">' + blocks + '</div>';
  }

  function renderDaf(layout) {
    if (layout.missing) return '<div class="vilna-missing">חסר טקסט</div>';
    const { cfg, plan } = layout;
    const amudA = /a$/i.test(layout.daf);
    const innerSide = amudA ? 'right' : 'left';   // Rashi inner: right on 'a', left on 'b'
    const title = hebrewDafTitle(layout.book, layout.daf);
    const g = cfg.fonts.gemara, c = cfg.fonts.comment;
    const vars = '--vilna-w:' + cfg.pageWidth + 'px;' +
      '--g-font:' + g.weight + ' ' + g.size + 'px/' + g.lineHeight + 'px ' + g.family + ';' +
      '--c-font:' + c.weight + ' ' + c.size + 'px/' + c.lineHeight + 'px ' + c.family + ';' +
      '--g-lh:' + g.lineHeight + 'px;--c-lh:' + c.lineHeight + 'px;--g-big:' + g.bigScale + ';--c-big:' + c.bigScale + ';' +
      '--g-bold:' + g.boldWeight + ';--c-bold:' + c.boldWeight + ';' +
      '--g-family:' + g.family + ';--dh-scale:' + ((cfg.dh && cfg.dh.scale) || 1) + ';--dh-weight:' + ((cfg.dh && cfg.dh.weight) || 700) + ';';
    const body = plan.regions.map((r) => renderRegion(r, layout.tokens, innerSide)).join('');
    return (
      '<div class="vilna-daf amud-' + (amudA ? 'a' : 'b') + (cfg.paper !== false ? ' vilna-paper' : '') + (plan.hourglass ? ' hourglass' : '') + '" data-ref="' + esc(layout.ref) + '" dir="rtl" style="' + esc(vars) + '">' +
      '<div class="vilna-daf-header"><span class="vilna-masechet">' + esc(title.masechet) + '</span>' +
      '<span class="vilna-daf-ref">' + esc(title.daf) + '</span></div>' +
      '<div class="vilna-body">' + body + '</div></div>'
    );
  }

  /**
   * Look-and-feel overrides, injected once. Appended AFTER index.html's <style>, so these win
   * on equal specificity. Only touches .vilna-daf — nothing else on the page.
   */
  function injectStyle() {
    if (typeof document === 'undefined' || document.getElementById('vilna-daf-style')) return;
    const st = document.createElement('style');
    st.id = 'vilna-daf-style';
    st.textContent = [
      /* DH of Rashi/Tosafot: square letters, bold — measured with the same face (tokenFont) */
      '.vilna-daf .vb.comm .dh,.vilna-daf .vb.comm .big{font-family:var(--g-family) !important;font-weight:var(--dh-weight,700) !important;font-synthesis:weight}',
      '.vilna-daf .vb.comm .dh{font-size:calc(1em * var(--dh-scale,1))}',
      /* Mishnah runs heavier than Gemara */
      '.vilna-daf .vb.gemara .mish{font-weight:var(--g-bold,700) !important;font-synthesis:weight}',
      /* Page: ivory paper, hairline frame, double rule under the title like a printed daf */
      '.vilna-daf.vilna-paper{background:#fbf7ec;color:#161412;border:1px solid rgba(60,45,20,.28);box-shadow:0 1px 3px rgba(13,35,64,.08),0 8px 22px rgba(13,35,64,.08);padding:12px 16px 20px;border-radius:2px}',
      '.vilna-daf .vilna-daf-header{border-bottom:3px double rgba(22,20,18,.7);padding:0 6px 6px;margin-bottom:12px;font-size:22px;letter-spacing:.02em}',
      '.vilna-daf .vilna-daf-ref{font-size:.9em}',
      '.vilna-daf .vl{font-kerning:normal}',
      '@media print{.vilna-daf.vilna-paper{background:#fff !important;border:0;box-shadow:none}}'
    ].join('\n');
    document.head.appendChild(st);
  }
  injectStyle();

  /** Scale a rendered daf down to fit its container (design width stays constant). */
  function fitToWidth(dafEl) {
    const host = dafEl.parentElement; if (!host) return;
    const k = Math.min(1, host.clientWidth / dafEl.offsetWidth);
    dafEl.style.zoom = String(k);
  }

  /* ───────────────────────── Local data service ───────────────────────── */
  const LocalData = {
    gemaraUrl(book) { return './texts/03_Gemara/' + encodeURIComponent(book + ' Gemara Hebrew.json'); },
    rashiUrl(book) { return './texts/05_Commentaries/' + encodeURIComponent(book + ' Rashi Hebrew.json'); },
    tosafotUrl(book) { return './texts/05_Commentaries/' + encodeURIComponent(book + ' Tosafot Hebrew.json'); },

    dafIndex(label) {
      const m = String(label || '').trim().match(/^(\d+)([ab])?$/i);
      if (!m) return -1;
      return parseInt(m[1], 10) * 2 + ((m[2] || 'a').toLowerCase() === 'b' ? 1 : 0) - 2;
    },
    indexToDaf(i) {
      const x = i + 2;
      return Math.floor(x / 2) + (x % 2 === 0 ? 'a' : 'b');
    },

    async fetchJson(url) {
      const res = await fetch(url);
      if (!res.ok) { const err = new Error('Missing local data: ' + url + ' (' + res.status + ')'); err.missing = true; throw err; }
      return res.json();
    },
    async loadBookText(book) { const d = await this.fetchJson(this.gemaraUrl(book)); return d.text || d.he || []; },
    async loadRashi(book) {
      try { const d = await this.fetchJson(this.rashiUrl(book)); return d.text || d.he || []; }
      catch (e) { if (e.missing) return null; throw e; }
    },
    async loadTosafot(book) {
      try { const d = await this.fetchJson(this.tosafotUrl(book)); return d.text || d.he || []; }
      catch (e) { if (e.missing) return null; throw e; }
    },

    cellTexts(cell) { return flatStrings(cell).map(normalizeText).filter(Boolean); },

    /** Whole amud → three raw-HTML string streams (tags kept for dibbur/bold parsing). */
    buildAmudBlocks(book, dafLabel, gemaraAmud, rashiAmud, tosafotAmud) {
      const gemaraStrs = flatStrings(gemaraAmud);
      const rashiStrs = flatStrings(rashiAmud);
      const tosfosStrs = flatStrings(tosafotAmud);
      const gemaraText = gemaraStrs.map(normalizeText).join(' ');
      return {
        ref: book + ' ' + dafLabel, book, daf: dafLabel,
        gemaraStrs, rashiStrs, tosfosStrs,
        gemaraText,
        rashiText: rashiStrs.map(normalizeText).join(' '),
        tosfosText: tosfosStrs.map(normalizeText).join(' '),
        hasMishnah: /^מתני[׳']/.test(gemaraText),
        stats: { ref: book + ' ' + dafLabel, gemaraBlocks: gemaraStrs.length, rashiBlocks: rashiStrs.length, tosfosBlocks: tosfosStrs.length },
      };
    },
  };

  function layoutUnitsFromAmud(amud, options) { return [layoutAmud(amud, options)]; }

  /* ───────────────────────── Public build API ───────────────────────── */
  function parseRef(ref) {
    const m = String(ref || '').trim().match(/^(.+?)\s+(\d+[ab]?)$/i);
    return m ? { book: m[1].trim(), daf: m[2].toLowerCase() } : null;
  }
  function missingCard(ref, detail) {
    return '<div class="vilna-error" data-ref="' + esc(ref) + '"><div class="vilna-error-title">Missing local data</div>' +
      '<div class="vilna-error-msg">' + esc(detail || ref) + '</div></div>';
  }

  /** Pure (no I/O): raw Sefaria cells in, layout + html out. Handy for tests. */
  function buildDafFromData(book, daf, gemaraAmud, rashiAmud, tosafotAmud, options) {
    const amud = LocalData.buildAmudBlocks(book, daf, gemaraAmud, rashiAmud, tosafotAmud);
    const layout = layoutAmud(amud, options);
    return Object.assign({}, layout, { stats: amud.stats, units: [layout], html: renderDaf(layout) });
  }

  async function buildVilnaDaf(ref, options) {
    const parsed = parseRef(ref);
    if (!parsed) throw new Error('Bad daf ref: ' + ref);
    const { book, daf } = parsed;
    const idx = LocalData.dafIndex(daf);
    if (idx < 0) throw new Error('Bad daf label: ' + daf);

    let gemaraAll;
    try { gemaraAll = await LocalData.loadBookText(book); }
    catch (e) { const err = new Error('Missing local Gemara file for ' + book); err.missing = true; throw err; }
    if (!Array.isArray(gemaraAll) || idx >= gemaraAll.length) {
      const err = new Error('Missing local data for ' + book + ' ' + daf + ' (index ' + idx + ')'); err.missing = true; throw err;
    }
    const [rashiAll, tosafotAll] = await Promise.all([LocalData.loadRashi(book), LocalData.loadTosafot(book)]);
    const g = gemaraAll[idx];
    if (!g || (Array.isArray(g) && !g.length)) {
      const err = new Error('Missing local data for ' + book + ' ' + daf); err.missing = true; throw err;
    }
    await ensureFonts(mergeCfg(options));
    return buildDafFromData(book, daf, g, rashiAll && rashiAll[idx], tosafotAll && tosafotAll[idx], options);
  }

  async function buildVilnaRange(bookTitle, dafLabels, options) {
    const parts = [];
    for (const label of dafLabels) {
      const ref = bookTitle + ' ' + label;
      try { parts.push((await buildVilnaDaf(ref, options)).html); }
      catch (e) { parts.push(missingCard(ref, e.message || String(e))); }
    }
    return parts.join('');
  }

  async function listDafim(bookTitle) {
    const text = await LocalData.loadBookText(bookTitle);
    const labels = [];
    for (let i = 0; i < text.length; i++) {
      const a = text[i];
      if (!a || (Array.isArray(a) && !a.length)) continue;
      labels.push(LocalData.indexToDaf(i));
    }
    return labels;
  }

  global.VilnaGemara = {
    config, normalizeText, parseRich, wrapText, breakLines, hebNum, hebrewDafTitle,
    layoutAmud, layoutUnitsFromAmud, renderDaf, fitToWidth, ensureFonts,
    buildDafFromData, buildVilnaDaf, buildVilnaRange, listDafim, LocalData,
  };
})(typeof window !== 'undefined' ? window : globalThis);
