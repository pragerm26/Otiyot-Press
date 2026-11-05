// Vilna-Shas-style daf layout from local Sefaria JSON (no network).
//
// Architecture:
//   1. Sefaria HTML → styled word tokens (dibbur hamatchil <b> preserved; soft punct strip
//      keeps Hebrew ׳ ״ so abbreviations like ר״י survive).
//   2. Every word is MEASURED in real pixels with the real fonts (canvas measureText).
//   3. Paragraphs are broken with TeX-style stretch/shrink total-fit (Knuth–Plass).
//   4. The page is planned as shared-height BANDS via beam search (not pure shortest-
//      stream sweep), scoring height waste + stream imbalance + hourglass phase.
//   5. Gemara column width is searched so the 3-column hourglass body is as tall as possible.
//   6. Every line is emitted explicitly and justified with exact word-spacing.
//   7. Column sides flip per amud: Rashi INNER margin, Tosafot OUTER.
//   8. Mishnah weight: structural token ranges when provided, else מתני׳…גמ׳ heuristics.

(function (global) {
  'use strict';

  /* ───────────────────────── Config ───────────────────────── */
  const DEFAULTS = {
    pageWidth: 940,          // design width in px (use fitToWidth() to scale to a container)
    gap: 6,                  // hairline gutter
    topBandLines: 4,  // classic Vilna: 4 wide Rashi|Tosafot lines above the Gemara body
    /**
     * Hourglass: the Gemara is wide at the top ("shoulders"), pinched to a narrow waist in
     * the middle where Rashi + Tosafot bulge inward, then wide again for its last lines
     * before the commentaries wrap beneath it. top/bottom = Gemara lines set at the wide width.
     */
    /**
     * Column shares of the PAGE (classic Vilna צורת הדף):
     *   Gemara stays a steady center column (~40%).
     *   Rashi = inner margin, Tosafot = outer; each ~28% when both present.
     *   Mild shoulder: first/last few Gemara lines a bit wider (not a dramatic pinch).
     *   When one commentary ends, Gemara expands into that space.
     *   Leftover commentary flows full-width under the Gemara.
     */
    hourglass: {
      on: true,
      top: 0,
      bottom: 0,
      short:  0.40,       // steady center ~40%
      long:   0.40,       // same — no wide top lines
      medium: 0.40,
      minSideFrac: 0.22,
      taper: false,
    },
    preferredFraction: 0.40,
    fractions: null,         // null = search 0.28…0.52; or pass e.g. [0.4] to pin it
    orphanPx: 40,            // leftover this short (≈1–2 lines) is absorbed, not given its own region
    safety: 0.5,             // px shaved off each measured line width
    stripNikud: true,
    /**
     * Soft punctuation handling: strip light decorative noise (ASCII quotes/dashes) but
     * KEEP Hebrew geresh/gershayim (׳ ״) so abbreviations like ר״י stay intact. Set false
     * to keep all punctuation in the token stream.
     */
    ignorePunct: true,
    /** Beam width for band-based page search (1 = classic shortest-stream sweep). */
    beamWidth: 48,
    /** Ideal inter-word space as a multiple of the measured space width (TeX-style). */
    spaceStretch: 1.5,       // max stretch before overfull cost ramps up
    spaceShrink: 0.5,        // min shrink (spaces can compress to this fraction)
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
      // budgets for steady ~40% Gemara center + ~28% side margins
      gemara:  { short: 32, normal: 42, wide: 48 },
      comment: { short: 42, normal: 52, wide: 64 },
    },
    fonts: {
      // Spec defaults: Gemara 20px, commentary 15px; line-heights via ratio (scaleConfig)
      gemara:  { family: '"Frank Ruhl Libre","Noto Serif Hebrew","Times New Roman",serif', size: 18.5, lineHeight: 22, lineHeightRatio: 1.19, weight: 500, boldWeight: 700, bigScale: 1.22 },
      comment: { family: '"Noto Rashi Hebrew","Frank Ruhl Libre","Times New Roman",serif', size: 11, lineHeight: 12.5, lineHeightRatio: 1.14, weight: 400, boldWeight: 700, bigScale: 1.03 },
    },
    /** Column shares of pageWidth (percentage model — preferred over char budgets). */
    columns: {
      waist: 0.40,
      wide: 0.40,
      medium: 0.40,
      gutter: 0.012,
      minSide: 0.22,
      maxSide: 0.28,
    },
    columnPad: { left: 4, right: 4 },

    // Optional: (text, cssFontString) => px. Default uses a canvas. Inject for tests/workers.
    measureText: null,
    /**
     * Layout objective weights for beam-search band planning.
     * Higher = more expensive. Expose so callers can tune without forking the planner.
     */
    layoutCosts: {
      heightWaste: 1.0,
      streamImbalance: 1.0,
      hourglassPhase: 1.0,
      commentarySplit: 2.0,
      paragraphWidow: 1.5,
      spacingPenalty: 1.25,
      columnEndingMismatch: 0.75,
    },
    /** Debug overlay: region outlines, segment IDs, overfull lines, alignment provenance. Off by default. */
    debug: false,
    /** Confidence floor for heuristic dibbur hamatchil; below this, leave unbolded. */
    dibburConfidenceMin: 0.55,
    /** Dibbur hamatchil styling: square (Gemara) face, bold Rashi, enlarged Tosafot. */
    dh: { square: true, weight: 700, scale: 1.0, tosafotScale: 1.15 },
  };

  /**
   * Soft punctuation strip sets.
   * Real Vilna Gemara has no Western punctuation — commas/periods/colons/questions are
   * modern Sefaria editorial marks. We strip those from the Gemara stream so they do not
   * affect measurement or spacing. Hebrew geresh/gershayim (׳ ״) stay (abbreviations).
   * Commentary keeps dashes used for dibbur hamatchil.
   */
  /** Light strip: quotes/noise only (used when ignorePunct and role is commentary). */
  const PUNCT_RE = /["""''`´«»…·•]/g;
  /** Gemara strip: Western sentence punctuation Sefaria injects into the base text. */
  const GEMARA_PUNCT_RE = /["""''`´«»…·•.,;:!?()\[\]{}–—‒−‐‑\-]/g;

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

  /* ───────────────────────── Line fill / space ratios ───────────────────────── */
  const BREAK_DEFAULTS = {
    spaceMin: 0.55,       // hard floor — reject below
    spaceMax: 1.65,       // hard ceiling — reject above
    idealMin: 0.85,       // zero-cost band
    idealMax: 1.15,
    softMin: 0.70,        // preferred squeeze floor
    softMax: 1.25,        // preferred stretch ceiling
    normalMax: 1.45,      // normal stretch before heavy cost
    touchFloor: 0.4,      // words must never touch
    // Target fill ratios (line ink / available width)
    fillGemara: { min: 0.92, max: 0.98, ideal: 0.95 },
    fillComment: { min: 0.90, max: 0.97, ideal: 0.93 },
  };

  function fillRatio(wordW, gaps, space, availW) {
    if (!(availW > 0)) return 0;
    const gapsN = Math.max(0, gaps | 0);
    return (wordW + gapsN * space) / availW;
  }

  function spaceRatio(wordW, gaps, space, availW) {
    const gapsN = Math.max(0, gaps | 0);
    if (gapsN <= 0 || !(space > 0)) return null;
    return (availW - wordW) / (gapsN * space);
  }

  function isSpaceRatioValid(r, opts) {
    const o = opts || BREAK_DEFAULTS;
    if (r == null || !isFinite(r)) return false;
    return r >= o.spaceMin - 1e-12 && r <= o.spaceMax + 1e-12;
  }

  function spaceCost(r, opts) {
    const o = opts || BREAK_DEFAULTS;
    if (r == null || !isFinite(r)) return Infinity;
    if (r < o.spaceMin - 1e-12 || r > o.spaceMax + 1e-12) return Infinity;
    if (r >= o.idealMin && r <= o.idealMax) return 0;
    if (r < o.idealMin) {
      const t = (o.idealMin - r) / Math.max(1e-9, o.idealMin - o.spaceMin);
      return t * t;
    }
    const t = (r - o.idealMax) / Math.max(1e-9, o.spaceMax - o.idealMax);
    return t * t;
  }

  function lineMetrics(line, availW, space, opts) {
    const o = opts || BREAK_DEFAULTS;
    const wordW = line.wordW || 0;
    const gaps = Math.max(0, (line.gaps | 0));
    const fr = fillRatio(wordW, gaps, space, availW);
    let sr = spaceRatio(wordW, gaps, space, availW);
    if (line.ragged && sr != null && sr > 1) sr = 1;
    const flags = [];
    let overfull = false;
    let hard = false;
    if (gaps === 0 && wordW > availW + 0.5) {
      overfull = true; hard = true; flags.push('overfull-word');
    }
    let ratioUsed = sr;
    if (sr != null) {
      if (sr < o.touchFloor) { ratioUsed = o.touchFloor; flags.push('touch-floor'); }
      if (sr < o.spaceMin) {
        flags.push('hard-squeeze');
        hard = true;
        if (wordW + gaps * space * o.touchFloor > availW + 0.5) overfull = true;
      }
      if (sr > o.spaceMax) { flags.push('hard-stretch'); hard = true; }
    }
    let inkFinal = wordW;
    if (gaps > 0) {
      if (line.ragged) {
        // Ragged: spaces stay natural (sr clamped to ≤1 already)
        inkFinal = wordW + gaps * space * (sr != null ? Math.min(1, Math.max(o.touchFloor, sr)) : 1);
      } else if (sr != null && sr >= o.touchFloor && sr <= o.spaceMax) {
        inkFinal = availW; // justified to the column
      } else {
        const used = ratioUsed != null ? Math.max(o.touchFloor, Math.min(ratioUsed, o.spaceMax)) : 1;
        inkFinal = wordW + gaps * space * used;
      }
    }
    return {
      fillRatio: fr,
      spaceRatio: sr,
      ratioUsed: ratioUsed != null ? ratioUsed : null,
      ink: inkFinal,
      availW: availW,
      overfull: !!overfull,
      hard: !!hard,
      flags: flags,
    };
  }

  function scaleConfig(cfg) {
    const c = cfg || mergeCfg({});
    const base = 940;
    const P = c.pageWidth || base;
    const k = P / base;
    const out = Object.assign({}, c);
    out.fonts = {
      gemara: Object.assign({}, c.fonts.gemara),
      comment: Object.assign({}, c.fonts.comment),
    };
    ['gemara', 'comment'].forEach(function (r) {
      const f = out.fonts[r];
      const designSize = (c.fonts[r] && c.fonts[r].size != null) ? c.fonts[r].size : (DEFAULTS.fonts[r].size);
      f.size = designSize * k;
      let ratio = f.lineHeightRatio;
      if (ratio == null && f.lineHeight != null && designSize > 0) {
        ratio = f.lineHeight / designSize;
      }
      if (ratio == null) ratio = r === 'gemara' ? 1.4 : 1.27;
      f.lineHeightRatio = ratio;
      f.lineHeight = f.size * ratio;
      if (r === 'comment' && f.bigScale > 1.05) f.bigScale = 1.05;
    });
    out.gap = (c.gap != null ? c.gap : DEFAULTS.gap) * k;
    out.gapPx = out.gap;
    const pad = c.columnPad || DEFAULTS.columnPad || { left: 4, right: 4 };
    out.padPx = { left: pad.left * k, right: pad.right * k };
    out.columnPad = pad;
    out.safety = (c.safety != null ? c.safety : 1.5) * k;
    out.warnings = out.warnings || [];
    out.columns = Object.assign({
      waist: 0.37, wide: 0.50, gutter: 0.015, minSide: 0.20, maxSide: 0.26,
    }, c.columns || {});
    return out;
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

  /* ───────────────────────── Sefaria document model ───────────────────────── */
  /**
   * Explicit structural markers from Sefaria HTML (preferred over word heuristics).
   * @param {string} html
   * @returns {"mishnah_opening"|"gemara_opening"|null}
   */
  function detectStructuralMarker(html) {
    const s = String(html || '');
    // Strip nikud for marker matching only (source HTML keeps nikud)
    const bare = s.replace(/[\u0591-\u05C7]/g, '');
    const headBare = bare.replace(/<[^>]+>/g, ' ').slice(0, 120);
    const hasBigStrong = /<big[^>]*>\s*<strong[^>]*>/i.test(s) || /<strong[^>]*>\s*<big[^>]*>/i.test(s);
    // גמ׳ label (with optional geresh) near the start after tags stripped
    if (hasBigStrong && /(?:^|[\s>])גמ[׳'"״]?/.test(headBare)) {
      return 'gemara_opening';
    }
    if (hasBigStrong) {
      // Opening big/strong that is not גמ׳ is treated as Mishnah opening (e.g. בֵּיצָה)
      return 'mishnah_opening';
    }
    return null;
  }

  function normalizeSefariaDocument(rawDoc, options) {
    const opts = options || {};
    const title = (rawDoc && (rawDoc.title || rawDoc.heTitle)) || opts.title || 'Unknown';
    const language = (rawDoc && rawDoc.language) || 'he';
    const text = (rawDoc && (rawDoc.text || rawDoc.he)) || [];
    const segments = [];
    const warnings = [];
    let currentKind = 'unknown';
    let prevNonEmptyKind = null;
    let prevNonEmptyIdx = -1;

    for (let chapterIndex = 0; chapterIndex < text.length; chapterIndex++) {
      const chapter = text[chapterIndex];
      const cells = Array.isArray(chapter) ? chapter : (chapter == null || chapter === '' ? [] : [chapter]);
      for (let segmentIndex = 0; segmentIndex < cells.length; segmentIndex++) {
        const html = cells[segmentIndex] == null ? '' : String(cells[segmentIndex]);
        const id = title + '.' + (chapterIndex + 1) + '.' + (segmentIndex + 1);
        const marker = detectStructuralMarker(html);
        let kind = currentKind;
        if (marker === 'mishnah_opening') {
          kind = 'mishnah';
          currentKind = 'mishnah';
        } else if (marker === 'gemara_opening') {
          kind = 'gemara';
          currentKind = 'gemara';
        } else if (currentKind !== 'unknown') {
          kind = currentKind;
        } else if (prevNonEmptyKind) {
          kind = prevNonEmptyKind;
        }

        const isEmpty = !html.trim();
        // Within a daf, Sefaria segment boundaries are NOT visual breaks.
        // Only structural markers (מתני׳ / גמ׳) start a new paragraph group.
        const continuesPrevious = !isEmpty && !marker &&
          prevNonEmptyIdx >= 0 &&
          !/^\s*<big/i.test(html);

        const seg = {
          id,
          chapter: chapterIndex + 1,
          chapterIndex,
          segmentIndex,
          kind,
          structuralMarker: marker,
          html,
          continuesPrevious,
          tokens: [],
          empty: isEmpty,
        };
        segments.push(seg);
        if (!isEmpty) {
          prevNonEmptyKind = kind;
          prevNonEmptyIdx = segments.length - 1;
        }
      }
    }

    // Conservative legacy fallback only when NO explicit markers exist in the whole document
    const anyMarker = segments.some((s) => s.structuralMarker);
    if (!anyMarker && opts.allowLegacyMishnahFallback !== false) {
      const joined = segments.map((s) => s.html).join('\n');
      const hasMatni = /(?:^|[\s>])מתני[ן׳']?(?:[\s<]|$)/.test(joined);
      const hasGam = /(?:^|[\s>])גמ[׳']?(?:[\s<]|$)|(?:^|[\s>])גמרא(?:[\s<]|$)/.test(joined);
      if (hasMatni && hasGam) {
        warnings.push('normalizeSefariaDocument: using legacy מתני׳…גמ׳ fallback (no <big><strong> markers)');
        let inMish = false;
        segments.forEach((s) => {
          if (/מתני[ן׳']?/.test(s.html) && /(?:^|[\s>])מתני/.test(s.html)) {
            inMish = true;
            s.kind = 'mishnah';
            s.structuralMarker = s.structuralMarker || 'mishnah_opening';
          } else if (inMish && /(?:גמ[׳']|גמרא)/.test(s.html)) {
            inMish = false;
            s.kind = 'gemara';
            s.structuralMarker = s.structuralMarker || 'gemara_opening';
          } else if (inMish) {
            s.kind = 'mishnah';
          } else if (s.kind === 'unknown') {
            s.kind = 'gemara';
          }
        });
      }
    }

    return { title, language, segments, warnings };
  }

  /**
   * Group consecutive same-kind segments into visual paragraphs.
   * Does NOT start a new paragraph merely because a new Sefaria segment begins.
   *
   * @param {object[]} segments - from normalizeSefariaDocument
   * @returns {object[]} paragraph groups
   */
  function buildParagraphs(segments) {
    const groups = [];
    let cur = null;
    (segments || []).forEach((seg) => {
      if (seg.empty) return;
      // Ignore Sefaria-inserted segment breaks: only structural markers or kind flips start a new group
      const startsNew = !cur ||
        seg.structuralMarker === 'mishnah_opening' ||
        seg.structuralMarker === 'gemara_opening' ||
        (seg.kind !== cur.kind && seg.kind !== 'unknown' && cur.kind !== 'unknown');
      if (startsNew) {
        cur = {
          kind: seg.kind,
          segmentIds: [seg.id],
          html: seg.html,
          startsNewColumn: false,
          structuralMarker: seg.structuralMarker,
        };
        groups.push(cur);
      } else {
        cur.segmentIds.push(seg.id);
        cur.html += (cur.html && !/\s$/.test(cur.html) && !/^\s/.test(seg.html) ? ' ' : '') + seg.html;
      }
    });
    return groups;
  }

  /**
   * Normalize a Rashi or Tosafot Sefaria commentary document.
   * @param {object} rawCommentary
   * @param {"rashi"|"tosafot"} commentaryKind
   * @param {object} [options]
   * @returns {{ kind: string, entries: object[], warnings: string[] }}
   */
  function normalizeCommentaryDocument(rawCommentary, commentaryKind, options) {
    const opts = options || {};
    const kind = commentaryKind === 'tosafot' ? 'tosafot' : 'rashi';
    const title = (rawCommentary && (rawCommentary.title || rawCommentary.heTitle)) || opts.title || kind;
    const text = (rawCommentary && (rawCommentary.text || rawCommentary.he)) || [];
    const entries = [];
    const warnings = [];
    let order = 0;

    for (let chapterIndex = 0; chapterIndex < text.length; chapterIndex++) {
      const chapter = text[chapterIndex];
      const cells = Array.isArray(chapter) ? chapter : (chapter == null || chapter === '' ? [] : [chapter]);
      for (let segmentIndex = 0; segmentIndex < cells.length; segmentIndex++) {
        // Sefaria often nests multiple comments per amud-slot as string arrays.
        // Flatten so each atomic comment is its own entry (never String(array) → "a,b").
        const rawCell = cells[segmentIndex];
        const pieces = flatStrings(rawCell);
        if (!pieces.length) continue;
        for (let pi = 0; pi < pieces.length; pi++) {
          const html = pieces[pi];
          if (!String(html).trim()) continue;
          let baseRef = null;
          let alignment = 'inferred';
          if (rawCommentary && Array.isArray(rawCommentary.spanningRefs) && rawCommentary.spanningRefs[order]) {
            baseRef = String(rawCommentary.spanningRefs[order]);
            alignment = 'explicit';
          } else if (opts.baseRefs && opts.baseRefs[order]) {
            baseRef = String(opts.baseRefs[order]);
            alignment = 'explicit';
          }
          const id = kind === 'rashi'
            ? ('Rashi on ' + (opts.book || title) + ' ' + (opts.daf || '') + ':' + (order + 1)).replace(/\s+/g, ' ').trim()
            : ('Tosafot on ' + (opts.book || title) + ' ' + (opts.daf || '') + ':' + (order + 1)).replace(/\s+/g, ' ').trim();

          const dibbur = detectDibburHamatchil({ html, kind }, kind);
          entries.push({
            id,
            baseRef,
            alignment,
            html,
            order: order++,
            chapterIndex,
            segmentIndex,
            pieceIndex: pi,
            dibbur,
            tokens: [],
          });
        }
      }
    }
    return { kind, entries, warnings };
  }

  /**
   * Detect dibbur hamatchil for a commentary entry.
   * Priority: explicit <b>/<strong> → metadata → conservative linguistic heuristic.
   *
   * @param {{ html?: string, text?: string, dibbur?: object }} entry
   * @param {"rashi"|"tosafot"} commentaryKind
   * @returns {{ text: string, source: string, confidence: number, endIndex?: number }}
   */
  function detectDibburHamatchil(entry, commentaryKind) {
    const html = String((entry && (entry.html || entry.text)) || '');
    // 1. Explicit <b> / <strong> at the start
    const boldMatch = html.match(/^\s*<(?:b|strong)(?:\s[^>]*)?>([\s\S]*?)<\/(?:b|strong)>/i);
    if (boldMatch) {
      const text = boldMatch[1].replace(/<[^>]+>/g, '').trim();
      if (text) return { text, source: 'explicit_html', confidence: 1.0 };
    }
    // 2. Metadata / pre-attached dibbur
    if (entry && entry.dibbur && entry.dibbur.text) {
      return {
        text: entry.dibbur.text,
        source: entry.dibbur.source || 'sefaria_metadata',
        confidence: entry.dibbur.confidence != null ? entry.dibbur.confidence : 0.95,
      };
    }
    // 3. Conservative heuristic — only when no markup/metadata
    const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!plain) return { text: '', source: 'none', confidence: 0 };

    const OPENERS = [
      /^ת[״"]ו\b/, /^א[״"]ר\b/, /^אמר\s+רב(?:י)?\b/, /^דתנן\b/, /^ה[״"]ל\b/,
      /^בפ[׳']\b/, /^דקתני\b/, /^וכו[׳']?\b/, /^תניא\b/, /^תנן\b/,
    ];
    let conf = 0.35;
    let end = -1;
    // Dash separator (en/em/ascii) is a secondary signal only
    const dash = plain.match(/^(.{1,80}?)(\s*[–—‒−‐‑-]\s+)([\s\S]*)$/);
    if (dash && dash[1].trim()) {
      const left = dash[1].trim();
      const words = left.split(/\s+/);
      if (words.length <= 8) {
        end = left.length;
        conf = 0.7;
        if (OPENERS.some((re) => re.test(left))) conf = 0.85;
      }
    }
    if (end < 0) {
      const dot = plain.match(/^(.{2,55}?[.:])(\s+)([\s\S]{8,})$/);
      if (dot) {
        end = dot[1].length;
        conf = 0.55;
        if (OPENERS.some((re) => re.test(dot[1]))) conf = 0.75;
      }
    }
    if (end < 0) {
      const vku = plain.match(/^(.{2,55}?וכו[׳']?)(\s+)([\s\S]+)$/);
      if (vku) {
        end = vku[1].length;
        conf = 0.6;
      }
    }
    if (end < 0 && OPENERS.some((re) => re.test(plain))) {
      const words = plain.split(/\s+/).slice(0, 5);
      end = words.join(' ').length;
      conf = 0.5;
    }
    if (end <= 0) return { text: '', source: 'heuristic', confidence: 0 };
    return {
      text: plain.slice(0, end).trim(),
      source: 'heuristic',
      confidence: conf,
      endIndex: end,
    };
  }

  /**
   * Optional late-stage typographic pass (render time only).
   * Never run during parsing/tokenization by default.
   */
  function typographicNormalize(text, opts) {
    let s = String(text || '');
    opts = opts || {};
    if (opts.stripNikud) s = s.replace(NIKUD_ALL, '');
    // Normalize visually equivalent quotes to preferred forms
    s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    return s;
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
   * By default preserves nikud (when stripNikud:false), geresh/gershayim, ?, em-dashes,
   * and abbreviation punctuation. Soft ASCII quote noise may still be stripped when
   * ignorePunct is true.
   */
  function parseRich(html, cfg) {
    const out = [];
    const nik = cfg && cfg.stripNikud === false ? null : NIKUD_ALL;
    const dropPunct = !cfg || cfg.ignorePunct !== false;
    // 'gemara' → strip Western punct (not in printed Shas); else light strip only
    const punctRe = (cfg && cfg.punctMode === 'gemara') ? GEMARA_PUNCT_RE : PUNCT_RE;
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
      if (dropPunct) text = text.replace(punctRe, '');
      if (!text) continue;
      const startsSpace = /^\s/.test(text);
      const words = text.split(/\s+/).filter(Boolean);
      words.forEach((w, i) => {
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

  /**
   * Apply detectDibburHamatchil result onto tokens. Only bold when confidence is high enough.
   * @returns {boolean} whether dibbur was applied
   */
  function applyDibburToTokens(tokens, dibbur, minConf) {
    if (!dibbur || !dibbur.text || (dibbur.confidence || 0) < (minConf == null ? 0.55 : minConf)) return false;
    if (dibbur.source === 'explicit_html' && tokens.some((t) => t.b)) return true; // already from markup
    const target = dibbur.text.replace(/\s+/g, ' ').trim();
    if (!target) return false;
    let acc = '';
    for (let i = 0; i < tokens.length && i < 12; i++) {
      acc = (acc ? acc + ' ' : '') + tokens[i].t;
      tokens[i].b = 1;
      if (acc === target || acc.indexOf(target) === 0 || target.indexOf(acc) === 0 && acc.length >= target.length * 0.8) {
        return true;
      }
      // Stop if we've clearly gone past
      if (acc.length > target.length + 4) break;
    }
    return true;
  }

  /** @deprecated Prefer detectDibburHamatchil + applyDibburToTokens. Kept for back-compat. */
  function guessDibbur(tokens) {
    const lim = Math.min(tokens.length, 9);
    for (let i = 0; i < lim; i++) {
      const t = tokens[i].t;
      if (/^[–—‒-]$/.test(t)) { for (let k = 0; k < i; k++) tokens[k].b = 1; return; }
      if (/[.:]$/.test(t) || /וכו[׳']$/.test(t)) { for (let k = 0; k <= i; k++) tokens[k].b = 1; return; }
    }
  }

  /**
   * Mark dibbur hamatchil with <b> on the raw string BEFORE tokenization when confidence is high.
   * Uses detectDibburHamatchil; low-confidence heuristics leave the string untouched.
   */
  function markDibburHtml(html, commentaryKind, minConf) {
    const s = String(html || '');
    if (!s || /<b[\s>]|<strong[\s>]/i.test(s)) return s; // already marked
    const dh = detectDibburHamatchil({ html: s }, commentaryKind || 'rashi');
    if (!dh.text || dh.confidence < (minConf == null ? 0.55 : minConf)) return s;
    // Re-wrap only the detected lemma at the start of the plain text
    const plain = s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!plain.startsWith(dh.text)) {
      // Fall back to classic dash/dot wrapping for medium confidence
      const dash = s.match(/^([\s\S]{1,100}?)(\s*[–—‒−‐‑-]\s+)([\s\S]*)$/);
      if (dash && dash[1].trim() && dh.confidence >= 0.55) {
        return '<b>' + dash[1].trim() + '</b>' + dash[2] + dash[3];
      }
      return s;
    }
    // Prefer operating on the original string: wrap the first occurrence of the lemma words
    const escaped = dh.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return s.replace(new RegExp('^(\\s*)(' + escaped + ')'), '$1<b>$2</b>');
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

  /**
   * Shared measureText cache keyed by text + full font descriptor + optional DPR.
   * Measuring font string must exactly match the rendering font string.
   */
  function makeMeasure(cfg) {
    if (typeof cfg.measureText === 'function') return cfg.measureText;
    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (!canvas) throw new Error('No canvas available: pass options.measureText(text, cssFont)');
    const ctx = canvas.getContext('2d');
    const cache = new Map();
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    return function measureToken(text, font) {
      const k = font + '|dpr' + dpr + '|' + text;
      let w = cache.get(k);
      if (w === undefined) {
        ctx.font = font;
        w = ctx.measureText(text).width;
        cache.set(k, w);
      }
      return w;
    };
  }

  /** Wait until configured fonts are loaded. Do not run layout before this resolves. */
  async function waitForFonts(cfg) {
    return ensureFonts(cfg || config);
  }

  async function ensureFonts(cfg) {
    if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) return;
    const jobs = [];
    ['gemara', 'comment'].forEach((r) => {
      const f = cfg.fonts[r];
      jobs.push(document.fonts.load(fontString(f, false, false), 'אבג').catch(() => {}));
      jobs.push(document.fonts.load(fontString(f, true, false), 'אבג').catch(() => {}));
      jobs.push(document.fonts.load(fontString(f, false, true), 'אבג').catch(() => {}));
      jobs.push(document.fonts.load(fontString(f, true, true), 'אבג').catch(() => {}));
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
    // Floor space width: some Hebrew faces report 0 for U+0020, which collapses
    // the line-breaker into one-word lines.
    const sp = measure(' ', fontString(f, false, false));
    return Math.max(sp, f.size * 0.2);
  }

  /**
   * Post-layout audit: overfull/underfull lines, spacing outliers, column overflow, segment coverage.
   * @param {object} layout - result of layoutAmud / buildDafFromData
   * @param {object} [opts]
   * @returns {{ overfullLines: object[], underfullLines: object[], spacingOutliers: object[], columnOverflow: object[], segmentCoverage: object }}
   */
  function auditLayout(layout, opts) {
    const report = {
      overfullLines: [],
      underfullLines: [],
      spacingOutliers: [],
      columnOverflow: [],
      segmentCoverage: { expected: [], missing: [], present: [] },
    };
    if (!layout || !layout.plan || !layout.tokens) return report;
    const cfg = layout.cfg || {};
    const stretchLimit = (cfg.spaceStretch || 1.6);
    const safety = cfg.safety || 0;
    const roles = [
      { key: 'g', name: 'gemara' },
      { key: 'r', name: 'rashi' },
      { key: 't', name: 'tosafot' },
    ];
    const tokenMap = layout.tokens;
    (layout.plan.regions || []).forEach((reg, ri) => {
      (reg.blocks || []).forEach((b) => {
        const tk = b.role === 'gemara' ? tokenMap.g : b.role === 'rashi' ? tokenMap.r : tokenMap.t;
        const contentW = b.width - safety;
        (b.lines || []).forEach((line, li) => {
          const gaps = line.i1 - line.i0 - 1;
          const natural = line.natural != null ? line.natural
            : (() => {
                let w = 0;
                for (let i = line.i0; i < line.i1; i++) w += (tk[i] && tk[i].w) || 0;
                return w;
              })();
          const entry = {
            region: ri, role: b.role, line: li, width: contentW, natural,
            i0: line.i0, i1: line.i1,
          };
          // True overfull: cannot fit even at max shrink (minLen > contentW)
          const shrink = (cfg.spaceShrink != null ? cfg.spaceShrink : 0.5);
          const nominalSpace = (cfg.fonts && cfg.fonts[b.role === 'gemara' ? 'gemara' : 'comment']
            ? cfg.fonts[b.role === 'gemara' ? 'gemara' : 'comment'].size * 0.25 : 4);
          const minSpace = nominalSpace * shrink;
          const minLen = natural - (gaps > 0 ? gaps * (nominalSpace - minSpace) : 0);
          // natural already includes nominal gaps at full space; minLen ≈ wordW + gaps*minSpace
          // Recompute from tokens when possible for accuracy:
          let wordW = 0;
          if (tk) { for (let i = line.i0; i < line.i1; i++) wordW += (tk[i] && tk[i].w) || 0; }
          else wordW = natural - gaps * nominalSpace;
          const trueMinLen = wordW + gaps * minSpace;
          if (trueMinLen > contentW + 0.5) {
            report.overfullLines.push(Object.assign({ excess: trueMinLen - contentW, wordW, gaps }, entry));
          }
          if (!line.ragged && gaps > 0) {
            const spNeeded = (contentW - wordW) / gaps;
            if (spNeeded > nominalSpace * stretchLimit) {
              report.underfullLines.push(Object.assign({
                spacing: spNeeded, limit: nominalSpace * stretchLimit,
              }, entry));
            }
            if (spNeeded > nominalSpace * stretchLimit * 1.5 || spNeeded < -nominalSpace * 0.6) {
              report.spacingOutliers.push(Object.assign({ spacing: spNeeded }, entry));
            }
          }
          // Hard constraint: line must not exceed column width at max shrink
          if (trueMinLen > b.width + 0.5) {
            report.columnOverflow.push(Object.assign({ excess: trueMinLen - b.width }, entry));
          }
        });
      });
    });
    // Segment coverage (when provided)
    if (opts && Array.isArray(opts.expectedSegmentIds)) {
      report.segmentCoverage.expected = opts.expectedSegmentIds.slice();
      const present = new Set(opts.presentSegmentIds || []);
      opts.expectedSegmentIds.forEach((id) => {
        if (present.has(id)) report.segmentCoverage.present.push(id);
        else report.segmentCoverage.missing.push(id);
      });
    }
    return report;
  }

  /* ───────────────────────── Line breaking (TeX-style total fit) ───────────────────────── */
  const LINE_PEN = 0.002;          // small cost per line — avoids needless wrapping
  const OVERFULL_PEN = 1e4;
  const SHORT_LAST_PEN = 0.05;     // mild penalty for a very short final line

  /**
   * Optimal breaks for tokens[start..].
   * Cost is primarily (slack/width)² so lines fill evenly — the formula that already
   * worked for Hebrew daf layout. Stretch/shrink limits only gate true overfulls
   * (cannot shrink enough). Final paragraph line is free (ragged).
   *
   * Optional 5th arg `opts`: { stretch, shrink }.
   */
  function breakLines(tokens, start, width, space, opts) {
    const n = tokens.length - start;
    if (n <= 0) return [];
    const sp = Math.max(space || 0, 0.2);
    const o = Object.assign({}, BREAK_DEFAULTS, opts || {});
    const shrink = (opts && opts.shrink) != null ? opts.shrink : o.spaceMin;
    const stretchMax = (opts && opts.stretch) != null ? opts.stretch : o.spaceMax;
    const minSpace = sp * Math.min(shrink, o.spaceMin);
    const best = new Float64Array(n + 1).fill(Infinity);
    const from = new Int32Array(n + 1);
    best[0] = 0;
    for (let i = 0; i < n; i++) {
      if (best[i] === Infinity) continue;
      let wordW = 0;
      for (let j = i; j < n; j++) {
        wordW += tokens[start + j].w;
        const gaps = j - i;
        const minLen = wordW + gaps * minSpace;
        if (minLen > width && j > i) break;
        const nat = wordW + gaps * sp;
        let cost;
        if (j === n - 1) {
          const fill = width > 0 ? nat / width : 1;
          cost = fill < 0.3 ? SHORT_LAST_PEN * (0.3 - fill) : 0;
        } else if (gaps > 0) {
          const ratio = (width - wordW) / (gaps * sp);
          // Hard reject outside [spaceMin, spaceMax] for non-final lines
          if (ratio < o.spaceMin - 1e-12 || ratio > o.spaceMax + 1e-12) {
            if (j > i) continue;
            cost = OVERFULL_PEN;
          } else {
            const fill = Math.min(1, nat / Math.max(1, width));
            const empty = 1 - fill;
            cost = empty * empty * 4 + spaceCost(ratio, o) * 1.5 + LINE_PEN;
            if (nat > width) cost += ((nat - width) / width) * ((nat - width) / width);
          }
        } else {
          const fill = Math.min(1, wordW / Math.max(1, width));
          cost = wordW > width ? OVERFULL_PEN + (wordW - width)
               : (1 - fill) * (1 - fill) * 10 + LINE_PEN;
        }
        // Prefer continuous commentary: avoid starting a new line on a new entry (glue)
        if (j + 1 < n && tokens[start + j + 1] && tokens[start + j + 1].glue) {
          cost += 0.85; // soft nobreak before next Rashi/Tosafot entry
        }
        if (best[i] + cost < best[j + 1]) { best[j + 1] = best[i] + cost; from[j + 1] = i; }
      }
    }
    function packLine(s, e, ragged) {
      let wordW = 0;
      for (let k = s; k < e; k++) wordW += tokens[start + k].w;
      const gaps = Math.max(0, e - s - 1);
      const nat = wordW + gaps * sp;
      return { i0: start + s, i1: start + e, natural: nat, wordW: wordW, gaps: gaps, ragged: !!ragged };
    }
    if (best[n] === Infinity) {
      const lines = [];
      let s = 0;
      while (s < n) {
        let wordW = 0, e = s;
        for (; e < n; e++) {
          const gaps = e - s;
          const ww = wordW + tokens[start + e].w;
          if (e > s && gaps > 0) {
            const ratio = (width - ww) / (gaps * sp);
            if (ratio < o.spaceMin) break;
          }
          const next = ww + gaps * sp;
          if (e > s && next > width && (width - wordW) / (Math.max(1, gaps) * sp) < o.spaceMin) break;
          wordW = ww;
        }
        if (e === s) e = s + 1;
        lines.push(packLine(s, e, false));
        s = e;
      }
      if (lines.length) lines[lines.length - 1].ragged = true;
      return lines;
    }
    const lines = [];
    for (let e = n; e > 0; e = from[e]) {
      const s = from[e];
      lines.push(packLine(s, e, false));
    }
    lines.reverse();
    if (lines.length) lines[lines.length - 1].ragged = true;
    return lines;
  }

  /** A stream (Gemara / Rashi / Tosafot) with a read position and cached wraps. */
  function Cursor(tokens, space, lh, safety, breakOpts) {
    this.tokens = tokens; this.space = space; this.lh = lh; this.safety = safety;
    this.breakOpts = breakOpts || null;
    this.pos = 0; this.cache = new Map();
  }
  Cursor.prototype.reset = function () { this.pos = 0; };
  Cursor.prototype.done = function () { return this.pos >= this.tokens.length; };
  Cursor.prototype.linesAt = function (width) {
    const k = this.pos + '|' + Math.round(width * 10);
    let ls = this.cache.get(k);
    if (!ls) {
      ls = breakLines(this.tokens, this.pos, width - this.safety, this.space, this.breakOpts);
      this.cache.set(k, ls);
    }
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
  /** Peek how many lines remain at `width` without advancing. */
  Cursor.prototype.remaining = function (width) { return this.linesAt(width).length; };

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
    if (g) {
      // Solo Gemara: narrow centered column (daf never goes edge-to-edge)
      const gw = Math.round(P * 0.42);
      const from = Math.round((P - gw) / 2);
      return { type: 'gemara-solo', blocks: [{ role: 'gemara', from: from, width: gw }] };
    }
    const role = r ? 'rashi' : 'tosafot';
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
      if (h > 0) {
        blocks.forEach((b) => {
          const n = (b.lines || []).length;
          if (n <= 0) { b.lineStep = b.lh; return; }
          const natural = n * b.lh;
          const used = Math.min(h, natural * 1.12);
          b.lineStep = used / n;
        });
        h = Math.max.apply(null, blocks.map((b) => (b.lines || []).length * b.lineStep));
      }
      regions.push({ type, h, blocks });
    };

    // Optional wide band: first few Rashi|Tosafot lines run across the top
    // (classic Vilna: ~4 lines of each commentary above the Gemara body).
    if (cfg.topBandLines > 0 && !cur.r.done() && !cur.t.done()) {
      const want = cfg.topBandLines;
      const n = Math.min(want, cur.r.linesAt(hw).length, cur.t.linesAt(hw).length);
      if (n > 0) {
        const blocks = [{ role: 'rashi', from: 0, width: hw }, { role: 'tosafot', from: P - hw, width: hw }];
        emit('top', blocks, [cur.r.take(hw, n), cur.t.take(hw, n)]);
      }
    }

    // ── Hourglass geometry: three Gemara widths relative to the page ──
    // short (waist) / medium (body) / long (shoulders). Sides take the remainder.
    const hg = cfg.hourglass || {};
    const topLines = Math.max(0, hg.top == null ? 5 : hg.top);
    const botLines = Math.max(0, hg.bottom == null ? 5 : hg.bottom);
    const minSideFrac = hg.minSideFrac != null ? hg.minSideFrac : 0.18;
    const fracShort  = hg.short  != null ? hg.short  : 0.37;
    const fracLong   = hg.long   != null ? hg.long   : 0.50;
    const fracMed    = hg.medium != null ? hg.medium : (fracShort + fracLong) / 2;
    // Clamp so each side keeps minSideFrac of the page.
    function gemaraAndSides(frac) {
      let g = Math.round(P * frac);
      let side = (P - g - 2 * gap) / 2;
      const minSide = Math.round(P * minSideFrac);
      if (side < minSide) {
        side = minSide;
        g = Math.round(P - 2 * gap - 2 * side);
      }
      // Keep Gemara in a steady band: 36–42% of page (no wide top lines)
      const minG = Math.round(P * 0.36);
      const maxG = Math.round(P * 0.42);
      if (g < minG) { g = minG; side = (P - g - 2 * gap) / 2; }
      if (g > maxG) { g = maxG; side = (P - g - 2 * gap) / 2; }
      return { g: Math.max(120, g), side: Math.max(80, side) };
    }
    const waist = gemaraAndSides(fracShort);
    const mid = gemaraAndSides(fracMed);
    const shoulder = gemaraAndSides(fracLong);
    // Prefer the searched gw/sw when close to waist; else lock waist to page fractions
    const gwUse = Math.abs(gw - waist.g) < 24 ? gw : waist.g;
    const swUse = Math.abs(sw - waist.side) < 16 ? sw : waist.side;
    const gwM = mid.g, swM = mid.side;
    const gwW = shoulder.g;
    const swW = shoulder.side;
    // Activate hourglass when shoulder is meaningfully wider than waist and Gemara is long enough
    const hgOn = hg.on !== false && gwW > gwUse + 12 &&
      cur.g.linesAt(gwW).length >= Math.max(8, topLines + botLines + 2);
    // Gradual taper phases: top(wide) → taper(medium) → waist → taper → bottom(wide)
    let phase = topLines > 0 ? 'top' : 'waist';

    /**
     * Band planner with beam search.
     * Each band has a shared pixel height; every active stream contributes an integral
     * number of lines. Instead of always ending a band when the *shortest* stream
     * runs out, we consider a few candidate heights (especially near orphan thresholds)
     * and keep the best ~beamWidth partial page states.
     *
     * Seed MUST preserve the top Rashi|Tosafot band already emitted above — resetting
     * cursors to 0 would drop those 4 lines.
     */
    const beamW = Math.max(1, cfg.beamWidth || 1);
    const restore = (st) => {
      cur.g.pos = st.g; cur.r.pos = st.r; cur.t.pos = st.t; phase = st.phase;
      regions.length = 0;
      st.regions.forEach((r) => regions.push(r));
    };

    // Seed from the post-top-band cursor positions and regions
    let beam = [{
      g: cur.g.pos, r: cur.r.pos, t: cur.t.pos, phase,
      regions: regions.slice(), cost: 0,
    }];

    for (let guard = 0; guard < 80; guard++) {
      const next = [];
      for (const st of beam) {
        restore(st);
        const active = { g: !cur.g.done(), r: !cur.r.done(), t: !cur.t.done() };
        if (!active.g && !active.r && !active.t) {
          next.push(st);
          continue;
        }

        const three = active.g && active.r && active.t;
        // Waist uses page-relative short width; shoulders use long
        let gW = hgOn ? gwUse : gw, sW = hgOn ? swUse : sw, capG = Infinity;
        if (three && hgOn) {
          if (phase === 'top') { gW = gwW; sW = swW; capG = Math.max(2, topLines); }
          else if (phase === 'taper-down') { gW = gwM; sW = swM; capG = Math.max(1, Math.floor(topLines / 2)); }
          else if (phase === 'taper-up') { gW = gwM; sW = swM; capG = Math.max(1, Math.floor(botLines / 2)); }
          else if (phase === 'bottom') { gW = gwW; sW = swW; }
          else {
            // waist: leave room for taper-up + bottom shoulders
            const Lg = cur.g.linesAt(gW).length;
            const reserve = Math.ceil(botLines * gwW / Math.max(1, gW));
            if (Lg > reserve + 1) capG = Lg - reserve;
          }
        }

        const { type, blocks } = blocksFor(active, gW, sW, P, gap);
        // Available lines + pixel height per block (Gemara lh != comment lh → must balance in px)
        const availInfo = blocks.map((b) => {
          const c = cur[KEY[b.role]];
          let n = c.linesAt(b.width).length;
          if (b.role === 'gemara') n = Math.min(n, capG);
          return { n, lh: c.lh, px: n * c.lh, role: b.role };
        });
        const minAvail = Math.min.apply(null, availInfo.map((a) => a.n));
        if (minAvail <= 0) {
          next.push(st);
          continue;
        }
        // Shortest remaining content in pixels across active streams
        const minPx = Math.min.apply(null, availInfo.map((a) => a.px));
        if (minPx <= 0) {
          next.push(st);
          continue;
        }

        // Candidate band HEIGHTS in pixels (not equal line counts).
        // Equal line counts left huge gaps under Rashi/Tosafot because Gemara lh is taller.
        const candidates = new Set([minPx]);
        availInfo.forEach((a) => {
          // Full drain of this stream
          if (a.px >= 1 && a.px <= minPx) candidates.add(a.px);
          // Leave 0–3 lines on this stream
          for (let leave = 0; leave <= 3 && leave < a.n; leave++) {
            const px = (a.n - leave) * a.lh;
            if (px >= a.lh && px <= minPx) candidates.add(px);
          }
          if (a.px <= cfg.orphanPx && a.px >= a.lh) candidates.add(a.px);
        });
        // A couple of intermediate heights for beam diversity
        if (minPx > 2 * 40) {
          candidates.add(Math.max(40, Math.floor(minPx / 2)));
          candidates.add(Math.max(40, Math.floor(minPx * 0.75)));
        }

        const candList = Array.from(candidates).filter((px) => px >= 1 && px <= minPx).sort((a, b) => b - a);
        const limited = candList.slice(0, Math.max(3, Math.min(8, beamW)));

        for (const targetPx of limited) {
          restore(st);
          const active2 = { g: !cur.g.done(), r: !cur.r.done(), t: !cur.t.done() };
          let gW2 = hgOn ? gwUse : gw, sW2 = hgOn ? swUse : sw, capG2 = Infinity, phase2 = phase;
          const three2 = active2.g && active2.r && active2.t;
          if (three2 && hgOn) {
            if (phase2 === 'top') { gW2 = gwW; sW2 = swW; capG2 = Math.max(2, topLines); }
            else if (phase2 === 'taper-down') { gW2 = gwM; sW2 = swM; capG2 = Math.max(1, Math.floor(topLines / 2)); }
            else if (phase2 === 'taper-up') { gW2 = gwM; sW2 = swM; capG2 = Math.max(1, Math.floor(botLines / 2)); }
            else if (phase2 === 'bottom') { gW2 = gwW; sW2 = swW; }
            else {
              const Lg = cur.g.linesAt(gW2).length;
              const reserve = Math.ceil(botLines * gwW / Math.max(1, gW2));
              if (Lg > reserve + 1) capG2 = Lg - reserve;
            }
          }
          const geom = blocksFor(active2, gW2, sW2, P, gap);
          const blks = geom.blocks.map((b) => Object.assign({}, b));
          // Each stream fills as many lines as fit in targetPx (pixel-balanced band)
          const takes = blks.map((b) => {
            const c = cur[KEY[b.role]];
            let total = c.linesAt(b.width).length;
            if (b.role === 'gemara') total = Math.min(total, capG2);
            let n = Math.min(total, Math.max(1, Math.floor(targetPx / c.lh)));
            // Absorb orphans into this band when the leftover is tiny
            if (total - n > 0 && (total - n) * c.lh <= cfg.orphanPx) n = total;
            return c.take(b.width, Math.max(1, n));
          });
          // Emit without using outer `regions` directly — build local copy
          let h = 0;
          blks.forEach((b, i) => {
            b.lines = takes[i]; b.lh = cur[KEY[b.role]].lh;
            h = Math.max(h, b.lines.length * b.lh);
          });
          // Fill band height without over-stretching leading (max ~12% extra).
          // Remaining shortfall is acceptable only at the very bottom of a band.
          if (h > 0) {
            blks.forEach((b) => {
              const n = (b.lines || []).length;
              if (n <= 0) { b.lineStep = b.lh; return; }
              const natural = n * b.lh;
              const maxH = natural * 1.12;
              const used = Math.min(h, maxH);
              b.lineStep = used / n;
            });
            // Recompute region height from what we actually use (tighten empty tail)
            h = Math.max.apply(null, blks.map((b) => (b.lines || []).length * b.lineStep));
          }
          const newRegions = st.regions.concat([{ type: geom.type, h, blocks: blks }]);

          if (three2 && hgOn) {
            // Gradual: top(wide) → taper-down(medium) → waist → taper-up(medium) → bottom(wide)
            if (phase2 === 'top') phase2 = 'taper-down';
            else if (phase2 === 'taper-down') phase2 = 'waist';
            else if (phase2 === 'waist' && capG2 < Infinity && !cur.g.done() && !cur.r.done() && !cur.t.done()) phase2 = 'taper-up';
            else if (phase2 === 'taper-up') phase2 = 'bottom';
          }

          // Band cost: configurable weights (layoutCosts)
          const LC = cfg.layoutCosts || {};
          const wHeight = LC.heightWaste != null ? LC.heightWaste : 1.0;
          const wImbal = LC.streamImbalance != null ? LC.streamImbalance : 1.0;
          const wPhase = LC.hourglassPhase != null ? LC.hourglassPhase : 1.0;
          const wSplit = LC.commentarySplit != null ? LC.commentarySplit : 2.0;
          const wWidow = LC.paragraphWidow != null ? LC.paragraphWidow : 1.5;
          const wSpace = LC.spacingPenalty != null ? LC.spacingPenalty : 1.25;
          const wEnd = LC.columnEndingMismatch != null ? LC.columnEndingMismatch : 0.75;

          let imbalance = 0;
          let endingMismatch = 0;
          if (three2) {
            const rem = ['g', 'r', 't'].map((k) => cur[k].remaining(k === 'g' ? gW2 : sW2));
            const avg = (rem[0] + rem[1] + rem[2]) / 3;
            imbalance = rem.reduce((s, x) => s + Math.abs(x - avg), 0) / 3;
            // Rashi vs Tosafot remaining height mismatch
            endingMismatch = Math.abs(rem[1] - rem[2]);
          }
          const heightWaste = blks.reduce((s, b) => s + Math.max(0, h - b.lines.length * b.lh), 0) / Math.max(1, h);

          // Penalize splitting commentary across the hourglass pinch (waist phase with few lines)
          let splitPenalty = 0;
          if (three2 && phase2 === 'waist') {
            blks.forEach((b) => {
              if ((b.role === 'rashi' || b.role === 'tosafot') && b.lines && b.lines.length === 1) {
                splitPenalty += 1;
              }
            });
          }

          // Penalize starting a new Gemara paragraph on the final line of a band (widow)
          let widowPenalty = 0;
          blks.forEach((b) => {
            if (b.role !== 'gemara' || !b.lines || !b.lines.length) return;
            const last = b.lines[b.lines.length - 1];
            const tk = cur.g.tokens;
            if (last && last.i0 > 0 && tk[last.i0] && tk[last.i0 - 1]) {
              // Heuristic: token after a big/gamer marker is a new structural unit
              if (tk[last.i0].big || /^גמ[׳']?$/.test(tk[last.i0].t || '')) widowPenalty += 1;
            }
            // Commentary entry beginning at column break with <2 lines remaining in band
            if ((b.role === 'rashi' || b.role === 'tosafot') && b.lines.length < 2) {
              const first = b.lines[0];
              if (first && first.i0 === 0) widowPenalty += 0.5;
            }
          });

          // Soft spacing penalty: average |slack| on non-ragged lines
          let spacingPen = 0;
          blks.forEach((b) => {
            (b.lines || []).forEach((line) => {
              if (line.ragged) return;
              const gaps = line.i1 - line.i0 - 1;
              if (gaps <= 0) return;
              const slack = (b.width - (line.natural || 0)) / gaps;
              if (Math.abs(slack) > 6) spacingPen += Math.abs(slack) / 20;
            });
          });

          const phasePen = (three2 && hgOn && phase2 === 'waist') ? 0.01 * h : 0;

          const stepCost =
            0.15 * wHeight * heightWaste +
            0.02 * wImbal * imbalance +
            0.001 * h +
            0.05 * wSplit * splitPenalty +
            0.04 * wWidow * widowPenalty +
            0.03 * wSpace * spacingPen +
            0.01 * wEnd * endingMismatch +
            0.01 * wPhase * phasePen;

          next.push({
            g: cur.g.pos, r: cur.r.pos, t: cur.t.pos, phase: phase2,
            regions: newRegions, cost: st.cost + stepCost,
          });
        }
      }

      if (!next.length) break;
      // Keep the best beamW states (lowest cost); prefer finished pages
      next.sort((a, b) => {
        const aDone = a.g >= cur.g.tokens.length && a.r >= cur.r.tokens.length && a.t >= cur.t.tokens.length;
        const bDone = b.g >= cur.g.tokens.length && b.r >= cur.r.tokens.length && b.t >= cur.t.tokens.length;
        if (aDone !== bDone) return aDone ? -1 : 1;
        return a.cost - b.cost;
      });
      // Dedup by cursor positions
      const seen = new Set();
      beam = [];
      for (const st of next) {
        const key = st.g + '|' + st.r + '|' + st.t + '|' + st.phase;
        if (seen.has(key)) continue;
        seen.add(key);
        beam.push(st);
        if (beam.length >= beamW) break;
      }
      // Stop if every beam member is finished
      if (beam.every((st) => st.g >= cur.g.tokens.length && st.r >= cur.r.tokens.length && st.t >= cur.t.tokens.length)) break;
    }

    // Commit the best finished (or least-cost) plan
    beam.sort((a, b) => a.cost - b.cost);
    const winner = beam[0] || { regions: [], g: 0, r: 0, t: 0 };
    regions.length = 0;
    (winner.regions || []).forEach((r) => regions.push(r));
    cur.g.pos = winner.g; cur.r.pos = winner.r; cur.t.pos = winner.t;

    const H = regions.reduce((s, r) => s + r.h, 0);
    const h3 = regions.reduce((s, r) => s + (r.type === 'three' ? r.h : 0), 0);
    // Merge consecutive three-column regions with compatible widths into solid bands
    // so the page reads as one dense block, not stacked thin strips.
    (function mergeBands() {
      const out = [];
      for (let i = 0; i < regions.length; i++) {
        const r = regions[i];
        const prev = out[out.length - 1];
        const canMerge = prev && prev.type === 'three' && r.type === 'three' &&
          prev.blocks.length === r.blocks.length &&
          prev.blocks.every((b, j) => b.role === r.blocks[j].role && Math.abs(b.width - r.blocks[j].width) < 8);
        if (canMerge) {
          prev.h += r.h;
          prev.blocks.forEach((b, j) => {
            const add = r.blocks[j].lines || [];
            b.lines = (b.lines || []).concat(add);
            const n = b.lines.length;
            b.lineStep = n > 0 ? prev.h / n : b.lh;
          });
        } else {
          out.push(r);
        }
      }
      regions.length = 0;
      out.forEach((r) => regions.push(r));
    })();

    // A printed daf is a rectangle of three columns. Once both commentaries
    // are exhausted, stop — remaining Gemara belongs on the next amud.
    while (regions.length) {
      const last = regions[regions.length - 1];
      const roles = (last.blocks || []).map((b) => b.role);
      const onlyG = roles.length === 1 && roles[0] === 'gemara';
      if (onlyG || last.type === 'gemara-solo') regions.pop();
      else break;
    }
    const H2 = regions.reduce((s, r) => s + r.h, 0);
    return { regions, H: H2, h3, fraction: f, gemaraWidth: hgOn ? gwUse : gw, gemaraWideWidth: gwW, sideWidth: hgOn ? swUse : sw, sideWideWidth: swW, hourglass: hgOn, planCost: winner.cost || 0 };
  }

  function chooseLayout(cur, P, cfg) {
    const both = !cur.r.done() && !cur.t.done() && !cur.g.done();
    const cands = cfg.fractions || (both ? range(0.28, 0.52, 0.02) : [cfg.preferredFraction]);
    let best = null;
    cands.forEach((f) => {
      const p = planLayout(cur, P, cfg, f);
      // Prefer more 3-column body, closer to preferred fraction, lower band cost
      const tail = p.H ? (p.H - p.h3) / p.H : 0;
      p.score = tail + 0.55 * Math.abs(f - cfg.preferredFraction) + 0.15 * (p.planCost || 0);
      if (!best || p.score < best.score) best = p;
    });
    return best;
  }
  function range(a, b, s) { const o = []; for (let x = a; x <= b + 1e-9; x += s) o.push(+x.toFixed(3)); return o; }

  /* ───────────────────────── Streams & public layout ───────────────────────── */
  /**
   * Mishnah is set in heavier type than the Gemara on a real daf.
   * Prefer structural ranges when the data pipeline provides them
   * (amud.mishnahTokenRanges: [{start, end}, ...] over the flat token stream).
   * Prefer big/strong markers from parseRich; only then fall back to מתני׳…גמ׳
   * label heuristics (emits a console warning when used).
   */
  function markMishnah(tokens, ranges) {
    if (Array.isArray(ranges) && ranges.length) {
      ranges.forEach((rg) => {
        const a = Math.max(0, rg.start | 0);
        const b = Math.min(tokens.length, rg.end | 0);
        for (let k = a; k < b; k++) tokens[k].mish = 1;
      });
      return;
    }
    // Structural: tokens already marked big from <big><strong>… opening through גמ׳
    // are preferred; the word-regex fallback is last resort.
    let usedLegacy = false;
    for (let i = 0; i < tokens.length; i++) {
      if (!/^מתני[׳']?$/.test(tokens[i].t) && !(tokens[i].big && i === 0)) {
        // also accept opening big token that is not the גמ׳ label
        if (!(tokens[i].big && !/^גמ[׳']?$/.test(tokens[i].t))) continue;
      }
      if (/^גמ[׳']?$/.test(tokens[i].t)) continue;
      let end = -1;
      for (let j = i + 1; j < tokens.length && j < i + 400; j++) {
        if (/^גמ[׳']?$/.test(tokens[j].t) || (tokens[j].big && /גמ/.test(tokens[j].t))) {
          end = j;
          break;
        }
      }
      if (end < 0) continue;
      for (let k = i; k < end; k++) tokens[k].mish = 1;
      usedLegacy = usedLegacy || /^מתני[׳']?$/.test(tokens[i].t);
      i = end;
    }
    if (usedLegacy && typeof console !== 'undefined' && console.warn) {
      console.warn('markMishnah: used legacy מתני׳…גמ׳ token fallback; prefer structural ranges or <big><strong> markers');
    }
  }

  function buildStream(strs, role, cfg, measure, commentary, tosafotFirstBig, mishnahRanges, commentaryKind) {
    let tokens = [];
    const minConf = cfg.dibburConfidenceMin != null ? cfg.dibburConfidenceMin : 0.55;
    strs.forEach((s) => {
      // Tag DH with <b> on the raw string first when confidence is high enough
      const raw = commentary ? markDibburHtml(s, commentaryKind || (tosafotFirstBig ? 'tosafot' : 'rashi'), minConf) : s;
      // Gemara: strip Western punctuation so it does not take width or show on the daf
      const parseCfg = commentary ? cfg : Object.assign({}, cfg, { punctMode: 'gemara' });
      let t = parseRich(raw, parseCfg);
      // Prefer structural <b> from the source; fall back to detectDibburHamatchil
      if (commentary && t.length && !t.some((x) => x.b)) {
        const dh = detectDibburHamatchil({ html: s }, commentaryKind || (tosafotFirstBig ? 'tosafot' : 'rashi'));
        if (!applyDibburToTokens(t, dh, minConf)) {
          // very low confidence: leave unbolded
        }
      }
      // Tosafot: enlarge the whole dibbur hamatchil (classic large first lemma)
      if (tosafotFirstBig && t.length) {
        t.forEach((x) => { if (x.b) x.big = 1; });
      }
      // Rashi: ensure dibbur stays bold (b=1); never big unless source said so
      // Strip dash separators used only to mark the lemma — they are not printed on a real daf
      if (commentary && t.length) {
        const cleaned = [];
        t.forEach((x) => {
          // drop tokens that are only a dash / en-dash / em-dash
          if (/^[–—‒−‐‑\-]+$/.test(x.t)) return;
          // strip leading/trailing dashes glued to a word
          x.t = x.t.replace(/^[–—‒−‐‑\-]+/, '').replace(/[–—‒−‐‑\-]+$/, '');
          if (x.t) cleaned.push(x);
        });
        t = cleaned;
      }
      // Continuous stream: no forced line break between commentary entries
      if (commentary && tokens.length && t.length) {
        // Mark the first token of this entry as "glue" so breakLines prefers
        // not to start a brand-new line here — text keeps flowing mid-line.
        t[0].glue = 1;
      }
      tokens = tokens.concat(t);
    });
    if (!commentary) markMishnah(tokens, mishnahRanges);
    const space = measureTokens(tokens, role, cfg, measure);
    const breakOpts = { stretch: cfg.spaceStretch || 1.6, shrink: cfg.spaceShrink || 0.5 };
    return new Cursor(tokens, space, cfg.fonts[role].lineHeight, cfg.safety, breakOpts);
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
    let cfg = mergeCfg(options);
    if (options && options.pageWidth != null) cfg._pageWidthLocked = true;
    cfg = scaleConfig(cfg);
    // Prefer percentage columns over char budgets when columns are set
    if (!cfg.columns) applyCharBudgets(cfg, makeMeasure(cfg));
    const measure = makeMeasure(cfg);
    const cur = {
      g: buildStream(amud.gemaraStrs, 'gemara', cfg, measure, false, false, amud.mishnahTokenRanges),
      r: buildStream(amud.rashiStrs, 'comment', cfg, measure, true, false, null, 'rashi'),
      t: buildStream(amud.tosfosStrs, 'comment', cfg, measure, true, true, null, 'tosafot'),
    };
    const plan = chooseLayout(cur, cfg.pageWidth, cfg);
    const spaces = { g: cur.g.space, r: cur.r.space, t: cur.t.space };
    const ROLE_SPACE = { gemara: spaces.g, rashi: spaces.r, tosafot: spaces.t };
    (plan.regions || []).forEach(function (rg) {
      (rg.blocks || []).forEach(function (b) {
        const sp = ROLE_SPACE[b.role] != null ? ROLE_SPACE[b.role] : spaces.g;
        (b.lines || []).forEach(function (l) {
          const gaps = l.gaps != null ? l.gaps : Math.max(0, (l.i1 || 0) - (l.i0 || 0) - 1);
          let wordW = l.wordW;
          if (wordW == null) {
            wordW = 0;
            const tk = cur[{ gemara: 'g', rashi: 'r', tosafot: 't' }[b.role]].tokens;
            for (let i = l.i0; i < l.i1; i++) wordW += (tk[i] && tk[i].w) || 0;
          }
          l.wordW = wordW;
          l.gaps = gaps;
          const m = lineMetrics({ wordW: wordW, gaps: gaps, ragged: !!l.ragged }, b.width - (cfg.safety || 0), sp);
          l.fillRatio = m.fillRatio;
          l.spaceRatio = m.spaceRatio;
          l.ink = m.ink;
          l.availW = m.availW;
          if (m.overfull) l.overfull = true;
        });
      });
    });
    const cols = cfg.columns || {};
    plan.cand = {
      waist: cols.waist != null ? cols.waist : (cfg.preferredFraction || 0.37),
      wide: cols.wide != null ? cols.wide : ((cfg.hourglass && cfg.hourglass.long) || 0.50),
    };
    plan.gemaraWaistW = plan.gemaraWidth;
    plan.gemaraWideW = plan.gemaraWideWidth;
    const result = {
      ref: amud.ref, book: amud.book, daf: amud.daf, cfg: cfg, plan: plan,
      missing: cur.g.tokens.length === 0,
      tokens: { g: cur.g.tokens, r: cur.r.tokens, t: cur.t.tokens },
      spaces: spaces,
      hasMishnah: amud.hasMishnah,
      paragraphs: amud.paragraphs || null,
      commentaryMeta: amud.commentaryMeta || null,
      segmentIds: amud.segmentIds || null,
    };
    result.validation = validateLayout(result);
    if (cfg.debug) result.audit = auditLayout(result, {
      expectedSegmentIds: amud.segmentIds || [],
      presentSegmentIds: amud.segmentIds || [],
    });
    return result;
  }

  /* ───────────────────────── Rendering ───────────────────────── */
  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  const px = (n) => +n.toFixed(2) + 'px';

  function renderLine(line, tokens, width, space, cfg, pos) {
    const gaps = Math.max(0, line.i1 - line.i0 - 1);
    const sp = space != null ? space : 4;
    const shrink = (cfg && cfg.spaceShrink) || 0.55;
    let ws = 0;
    if (gaps > 0) {
      const target = width - ((cfg && cfg.safety) || 0);
      const minWs = -sp * (1 - shrink) - 0.25;
      if (line.ragged) {
        ws = Math.min(0, Math.max(minWs, (target - line.natural) / gaps));
      } else {
        ws = Math.max(minWs, (target - line.natural) / gaps);
      }
    }
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
    let dbg = '';
    if (cfg && cfg.debug) {
      const fr = line.fillRatio != null ? Math.round(line.fillRatio * 100) : 0;
      const sr = line.spaceRatio != null ? (+line.spaceRatio).toFixed(2) : '–';
      const aw = line.availW != null ? Math.round(line.availW) : Math.round(width);
      dbg = ' data-dbg="f' + fr + ' s' + sr + ' w' + aw + '"';
      if (line.overfull) dbg += ' data-overfull="1"';
    }
    let style = 'word-spacing:' + px(ws);
    if (line.ragged) style += ';text-align:start;text-align-last:start';
    if (pos) {
      if (pos.top != null) style += ';position:absolute;left:0;right:0;top:' + px(pos.top);
      if (pos.height != null) style += ';height:' + px(pos.height);
    }
    return '<div class="vl' + (line.ragged ? ' rg' : '') + '"' + dbg + ' style="' + style + '">' + html + '</div>';
  }

  function renderRegion(reg, layout, innerSide) {
    const tokens = layout.tokens || layout;
    const spaces = layout.spaces || {};
    const cfg = layout.cfg || {};
    const spFor = { gemara: spaces.g, rashi: spaces.r, tosafot: spaces.t };
    const blocks = reg.blocks.map((b) => {
      const tk = b.role === 'gemara' ? tokens.g : b.role === 'rashi' ? tokens.r : tokens.t;
      const sp = spFor[b.role] != null ? spFor[b.role] : 4;
      const pos = innerSide === 'right' ? 'right:' + px(b.from) : 'left:' + px(b.from);
      const step = b.lineStep != null ? b.lineStep : (b.lh || 20);
      const lines = (b.lines || []).map((l, i) => {
        return renderLine(l, tk, b.width, sp, cfg, { top: i * step, height: step });
      }).join('');
      return '<div class="vb ' + (b.role === 'gemara' ? 'gemara' : 'comm ' + b.role) + '" style="' + pos +
        ';width:' + px(b.width) + ';height:' + px(reg.h) + '">' + lines + '</div>';
    }).join('');
    return '<div class="vilna-region mode-' + reg.type + '" style="height:' + px(reg.h) + '">' + blocks + '</div>';
  }

  function renderDebugOverlay(layout) {
    if (!layout || !layout.cfg || !layout.cfg.debug) return '';
    const parts = [];
    parts.push('<div class="vilna-debug" style="pointer-events:none;position:absolute;inset:0;z-index:20;font:11px/1.2 monospace;color:#c00">');
    const audit = layout.audit || (layout.plan ? auditLayout(layout) : null);
    if (audit && audit.overfullLines && audit.overfullLines.length) {
      parts.push('<div class="vilna-debug-overfull" style="background:rgba(255,0,0,.12);padding:2px 4px">overfull: ' +
        audit.overfullLines.length + '</div>');
    }
    if (layout.segmentIds && layout.segmentIds.length) {
      parts.push('<div class="vilna-debug-segs" style="background:rgba(0,80,200,.08);padding:2px 4px;max-height:80px;overflow:auto">segments: ' +
        layout.segmentIds.map(esc).join(', ') + '</div>');
    }
    if (layout.paragraphs && layout.paragraphs.length) {
      parts.push('<div class="vilna-debug-paras" style="background:rgba(0,120,0,.08);padding:2px 4px">paragraphs: ' +
        layout.paragraphs.map((p) => esc(p.kind) + '[' + p.segmentIds.length + ']').join(' | ') + '</div>');
    }
    if (layout.commentaryMeta) {
      const paint = (entries, label) => {
        if (!entries || !entries.length) return '';
        return '<div style="padding:2px 4px">' + label + ': ' + entries.map((e) => {
          const color = e.alignment === 'explicit' ? '#0a0' : '#a80';
          return '<span style="color:' + color + '" title="' + esc(e.id) + '">' + esc(e.id) + '</span>';
        }).join(', ') + '</div>';
      };
      parts.push(paint(layout.commentaryMeta.rashi, 'Rashi'));
      parts.push(paint(layout.commentaryMeta.tosafot, 'Tosafot'));
    }
    (layout.plan && layout.plan.regions || []).forEach((reg, i) => {
      parts.push('<div class="vilna-debug-region" data-type="' + esc(reg.type) +
        '" style="outline:1px dashed rgba(0,0,180,.35);position:relative;height:' + px(reg.h) +
        ';box-sizing:border-box"><span style="position:absolute;top:0;left:2px;background:#fff8;color:#36c">' +
        esc(reg.type) + '#' + i + '</span></div>');
    });
    parts.push('</div>');
    return parts.join('');
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
    const body = plan.regions.map((r) => renderRegion(r, layout, innerSide)).join('');
    const debug = renderDebugOverlay(layout);
    return (
      '<div class="vilna-daf amud-' + (amudA ? 'a' : 'b') + (cfg.paper !== false ? ' vilna-paper' : '') + (plan.hourglass ? ' hourglass' : '') + (cfg.debug ? ' vilna-debug-on' : '') + '" data-ref="' + esc(layout.ref) + '" dir="rtl" style="' + esc(vars) + '">' +
      '<div class="vilna-daf-header"><span class="vilna-masechet">' + esc(title.masechet) + '</span>' +
      '<span class="vilna-daf-ref">' + esc(title.daf) + '</span></div>' +
      '<div class="vilna-body" style="position:relative">' + body + debug + '</div></div>'
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
      '.vilna-daf .vb.comm .dh{font-family:var(--g-family) !important;font-weight:var(--dh-weight,700) !important;font-synthesis:weight;font-size:calc(1em * var(--dh-scale,1))}',
      '.vilna-daf .vb.comm .big{font-family:var(--g-family) !important;font-weight:var(--dh-weight,700) !important;font-synthesis:weight;font-size:calc(1em * var(--c-big,1.05) * 1.12)}',
      /* Gemara reads as the heavy spine of the page */
      '.vilna-daf .vb.gemara{font-weight:500;color:#0a0806}',
      '.vilna-daf .vb.comm{color:#16120e}',
      /* Mishnah runs heavier than Gemara */
      '.vilna-daf .vb.gemara .mish{font-weight:var(--g-bold,700) !important;font-synthesis:weight}',
      /* Page: ivory paper, hairline frame, double rule under the title like a printed daf */
      '.vilna-daf.vilna-paper{background:#f7f1e1;color:#0e0c0a;border:1px solid #3a2e1a;box-shadow:0 1px 2px rgba(0,0,0,.12);padding:5px 7px 8px;border-radius:0}',
      '.vilna-daf .vilna-daf-header{border-bottom:2.5px double #1a1510;padding:0 2px 2px;margin-bottom:3px;font-size:16px;letter-spacing:.04em;font-weight:700}',
      '.vilna-daf .vilna-daf-ref{font-size:.9em}',
      '.vilna-daf .vl{font-kerning:normal}',
      /* Subtle column gutters — printed Vilna has hairline separation */
      '.vilna-daf .vilna-region.mode-three .vb.gemara{box-shadow:-1px 0 0 rgba(40,30,15,.18),1px 0 0 rgba(40,30,15,.18)}',
      '.vilna-daf .vilna-region.mode-top .vb.rashi{box-shadow:1px 0 0 rgba(40,30,15,.14)}',
      '.vilna-daf .vilna-region.mode-half .vb.rashi{box-shadow:1px 0 0 rgba(40,30,15,.14)}',
      /* Tighter body padding under the header */
      '.vilna-daf .vilna-body{margin-top:2px}',
      /* Print / Save-as-PDF */
      '@media print{',
      '.vilna-daf{width:var(--vilna-w,940px)!important;max-width:none!important;',
      'zoom:.78!important;transform:none!important;',
      'background:#fff!important;color:#000!important;',
      'border:0!important;box-shadow:none!important;',
      'page-break-after:always;break-after:page;',
      '-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      '.vilna-daf:last-of-type{page-break-after:auto;break-after:auto}',
      '.vilna-daf.vilna-paper{background:#fff!important;border:0!important;box-shadow:none!important}',
      '.vilna-region{position:relative!important;page-break-inside:avoid!important;break-inside:avoid!important;overflow:visible!important}',
      '.vb{position:absolute!important;overflow:visible!important;top:0}',
      '.vl{position:absolute;left:0;right:0;white-space:nowrap}',
      '.vl{overflow:visible!important;white-space:nowrap!important}',
      '.vilna-daf-header{page-break-after:avoid;break-after:avoid}',
      '.vilna-debug{display:none!important}',
      '}',
    ].join('\n');
    document.head.appendChild(st);
  }
  injectStyle();

  /** Scale a rendered daf down to fit its container (design width stays constant). */
  /**
   * Scale a rendered daf to its host width. Uses zoom when available (Chrome),
   * falls back to transform:scale so layout still works where zoom is ignored.
   * Print/PDF should rely on @media print rules from injectStyle rather than zoom.
   */
  function fitToWidth(dafEl) {
    const host = dafEl.parentElement; if (!host) return;
    const design = dafEl.offsetWidth || 940;
    const k = Math.min(1, host.clientWidth / design);
    if ('zoom' in dafEl.style) {
      dafEl.style.zoom = String(k);
      dafEl.style.transform = '';
      dafEl.style.marginBottom = '';
    } else {
      dafEl.style.zoom = '';
      dafEl.style.transformOrigin = 'top center';
      dafEl.style.transform = k < 0.999 ? ('scale(' + k + ')') : '';
      if (k < 0.999) {
        const h = dafEl.offsetHeight;
        dafEl.style.marginBottom = ((k - 1) * h) + 'px';
      } else {
        dafEl.style.marginBottom = '';
      }
    }
    dafEl.setAttribute('data-fit-scale', String(k));
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

    _jsonCache: new Map(),
    async fetchJson(url) {
      if (this._jsonCache.has(url)) return this._jsonCache.get(url);
      const res = await fetch(url);
      if (!res.ok) { const err = new Error('Missing local data: ' + url + ' (' + res.status + ')'); err.missing = true; throw err; }
      const j = await res.json();
      this._jsonCache.set(url, j);
      return j;
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

    /**
     * Whole amud → three raw-HTML string streams (tags kept for dibbur/bold parsing).
     * Uses normalizeSefariaDocument + buildParagraphs so consecutive Gemara segments
     * merge into continuous paragraphs, and Mishnah/Gemara boundaries come from
     * explicit <big><strong> markers when present.
     */
    buildAmudBlocks(book, dafLabel, gemaraAmud, rashiAmud, tosafotAmud) {
      // Synthesize a mini Sefaria doc for this single amud cell so the normalizer
      // can assign kinds/markers. chapterIndex 0 = this amud's segments.
      const rawDoc = {
        title: book,
        language: 'he',
        text: [Array.isArray(gemaraAmud) ? gemaraAmud : flatStrings(gemaraAmud)],
      };
      const normalized = normalizeSefariaDocument(rawDoc, { title: book });
      const paragraphs = buildParagraphs(normalized.segments);
      // gemaraStrs: continuous flow — Sefaria segment breaks are ignored.
      // Only keep separate strings when a real structural marker splits mishnah vs gemara.
      const gemaraStrs = paragraphs.length
        ? paragraphs.map((p) => p.html)
        : flatStrings(gemaraAmud);

      const rashiNorm = normalizeCommentaryDocument(
        { title: book + ' Rashi', text: [Array.isArray(rashiAmud) ? rashiAmud : flatStrings(rashiAmud)] },
        'rashi',
        { book, daf: dafLabel }
      );
      const tosafotNorm = normalizeCommentaryDocument(
        { title: book + ' Tosafot', text: [Array.isArray(tosafotAmud) ? tosafotAmud : flatStrings(tosafotAmud)] },
        'tosafot',
        { book, daf: dafLabel }
      );
      const rashiStrs = rashiNorm.entries.map((e) => e.html);
      const tosfosStrs = tosafotNorm.entries.map((e) => e.html);

      const gemaraText = gemaraStrs.map(normalizeText).join(' ');
      const hasMishnah = paragraphs.some((p) => p.kind === 'mishnah') ||
        normalized.segments.some((s) => s.kind === 'mishnah' && !s.empty) ||
        /^מתני[׳']/.test(gemaraText);

      // Token-range hints for markMishnah from paragraph kinds
      // (computed later in buildStream once tokens exist; here we expose segment ids)
      const segmentIds = normalized.segments.filter((s) => !s.empty).map((s) => s.id);
      const mishnahSegmentIds = normalized.segments.filter((s) => !s.empty && s.kind === 'mishnah').map((s) => s.id);

      return {
        ref: book + ' ' + dafLabel, book, daf: dafLabel,
        gemaraStrs, rashiStrs, tosfosStrs,
        gemaraText,
        rashiText: rashiStrs.map(normalizeText).join(' '),
        tosfosText: tosfosStrs.map(normalizeText).join(' '),
        hasMishnah,
        paragraphs,
        segmentIds,
        mishnahSegmentIds,
        commentaryMeta: {
          rashi: rashiNorm.entries.map((e) => ({
            id: e.id, baseRef: e.baseRef, alignment: e.alignment,
            dibbur: e.dibbur, order: e.order,
          })),
          tosafot: tosafotNorm.entries.map((e) => ({
            id: e.id, baseRef: e.baseRef, alignment: e.alignment,
            dibbur: e.dibbur, order: e.order,
          })),
        },
        normalized,
        stats: {
          ref: book + ' ' + dafLabel,
          gemaraBlocks: gemaraStrs.length,
          rashiBlocks: rashiStrs.length,
          tosfosBlocks: tosfosStrs.length,
          paragraphs: paragraphs.length,
          warnings: (normalized.warnings || []).concat(rashiNorm.warnings || [], tosafotNorm.warnings || []),
        },
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


  /**
   * Post-layout validation: overfull lines, space-ratio bounds, block overlaps.
   * @returns {{ ok: boolean, violations: Array<{type:string, detail?:any}> }}
   */
  function validateLayout(layout) {
    const violations = [];
    if (!layout || !layout.plan || !layout.plan.regions) {
      return { ok: false, violations: [{ type: 'missing-plan' }] };
    }
    const cfg = layout.cfg || {};
    const spaceByRole = layout.spaces || {};
    layout.plan.regions.forEach(function (rg, ri) {
      const blocks = rg.blocks || [];
      // Overlap check: absolute from/width rectangles on same band
      for (let i = 0; i < blocks.length; i++) {
        for (let j = i + 1; j < blocks.length; j++) {
          const a = blocks[i], b = blocks[j];
          const a0 = a.from || 0, a1 = a0 + (a.width || 0);
          const b0 = b.from || 0, b1 = b0 + (b.width || 0);
          const ay0 = a.top || 0, by0 = b.top || 0;
          const ay1 = ay0 + ((a.lines || []).length * (a.lh || 1));
          const by1 = by0 + ((b.lines || []).length * (b.lh || 1));
          const xOverlap = a0 < b1 - 0.5 && b0 < a1 - 0.5;
          const yOverlap = ay0 < by1 - 0.5 && by0 < ay1 - 0.5;
          if (xOverlap && yOverlap) {
            violations.push({ type: 'overlap', region: ri, roles: [a.role, b.role] });
          }
        }
      }
      blocks.forEach(function (b) {
        (b.lines || []).forEach(function (l, li) {
          if (l.overfull) violations.push({ type: 'overfull', region: ri, role: b.role, line: li });
          if (typeof l.fillRatio === 'number' && l.spaceRatio != null && !l.ragged) {
            if (!isSpaceRatioValid(l.spaceRatio, BREAK_DEFAULTS)) {
              violations.push({ type: 'space-ratio', region: ri, role: b.role, line: li, ratio: l.spaceRatio });
            }
          }
        });
      });
    });
    return { ok: violations.length === 0, violations: violations };
  }

  global.VilnaGemara = {
    config, DEFAULTS, BREAK_DEFAULTS, mergeCfg, scaleConfig,
    fillRatio, spaceRatio, isSpaceRatioValid, spaceCost, lineMetrics, validateLayout,
    normalizeText, parseRich, wrapText, breakLines, hebNum, hebrewDafTitle,
    layoutAmud, layoutUnitsFromAmud, renderDaf, fitToWidth, ensureFonts, waitForFonts,
    buildDafFromData, buildVilnaDaf, buildVilnaRange, listDafim, LocalData,
    normalizeSefariaDocument, buildParagraphs, normalizeCommentaryDocument,
    detectDibburHamatchil, applyDibburToTokens, markDibburHtml, typographicNormalize,
    auditLayout, detectStructuralMarker, markMishnah, measureTokens, makeMeasure,
  };
})(typeof window !== 'undefined' ? window : globalThis);
