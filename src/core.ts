// @ts-nocheck
export const TYPE_CODE_MAP = {
  1: "noun",
  2: "verb",
  3: "adjective",
  4: "adverb",
  5: "phrase",
  6: "other",
};

export const TYPE_OPTIONS = Object.entries(TYPE_CODE_MAP).map(([value, label]) => ({
  value: Number(value),
  label,
}));

export const DEFAULT_SETTINGS = {
  theme: "system",
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  fontSize: "medium",
  background: "plain",
  keyboardShortcutsEnabled: true,
  activeLanguagePairId: null,
};

export const LANGUAGE_REGISTRY = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "de", name: "German" },
  { code: "tr", name: "Turkish" },
  { code: "fr", name: "French" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "nl", name: "Dutch" },
  { code: "ar", name: "Arabic" },
  { code: "ru", name: "Russian" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "zh", name: "Chinese" },
  { code: "el", name: "Greek" },
  { code: "la", name: "Latin" },
];

export function canonicalPairId(firstCode, secondCode) {
  return [String(firstCode ?? "").trim().toLowerCase(), String(secondCode ?? "").trim().toLowerCase()]
    .sort()
    .join("-");
}

export function languageByCode(code) {
  return LANGUAGE_REGISTRY.find((language) => language.code === String(code ?? "").trim().toLowerCase());
}

export function languageByName(name) {
  return LANGUAGE_REGISTRY.find((language) => language.name.toLowerCase() === String(name ?? "").trim().toLowerCase());
}

export function languageLabel(code) {
  return languageByCode(code)?.name ?? String(code ?? "").toUpperCase();
}

export function pairLabel(pair) {
  if (!pair) return "No pair selected";
  return `${languageLabel(pair.sourceLanguage)}-${languageLabel(pair.targetLanguage)}`;
}

export function uid(prefix = "id") {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeType(typeCode) {
  return TYPE_CODE_MAP[typeCode] ?? "other";
}

export function entryKey(entry) {
  return `${entry.normalizedType}|${entry.normalizedSpanish}|${entry.normalizedEnglish}`;
}

export function createEntry({ datasetId, typeCode = 6, spanish, english, details = "", conjugation = "" }) {
  const time = nowIso();
  const numericType = Number(typeCode);
  const safeType = TYPE_CODE_MAP[numericType] ? numericType : 6;
  const entry = {
    id: uid("entry"),
    datasetId,
    typeCode: safeType,
    spanish: String(spanish ?? "").trim(),
    english: String(english ?? "").trim(),
    normalizedType: normalizeType(safeType),
    normalizedSpanish: normalizeText(spanish),
    normalizedEnglish: normalizeText(english),
    masteryCount: 0,
    createdAt: time,
    updatedAt: time,
  };
  const detailsText = String(details ?? "").trim();
  const conjugationText = String(conjugation ?? "").trim();
  if (detailsText) entry.details = detailsText;
  if (safeType === 2 && conjugationText) entry.conjugation = { raw: conjugationText };
  return entry;
}

export class VocabularyParser {
  parseText(text, datasetId, options = {}) {
    const entries = [];
    const invalidLines = [];
    const lines = String(text ?? "").split(/\r?\n/);
    const header = this.parseHeader(lines[0], datasetId, options.languagePairs ?? []);
    if (!header.valid) {
      invalidLines.push(header.invalidLine);
      return { entries, invalidLines, header: null };
    }
    lines.slice(1).forEach((line, index) => {
      const parsed = this.parseLine(line, datasetId, index + 2);
      if (!parsed) return;
      if ("error" in parsed) invalidLines.push(parsed);
      else entries.push({
        ...parsed,
        languagePairId: header.languagePairId,
        sourceLanguage: header.sourceLanguage,
        targetLanguage: header.targetLanguage,
      });
    });
    return { entries, invalidLines, header };
  }

  parseHeader(line, datasetId, languagePairs = []) {
    const originalText = String(line ?? "");
    const trimmed = originalText.trim();
    const invalidLine = (error) => ({
      id: uid("invalid"),
      datasetId,
      lineNumber: 1,
      originalText,
      error,
      editedText: originalText,
    });
    const parts = trimmed.split("/").map((field) => field.trim().toLowerCase());
    if (parts.length !== 3 || parts[0] !== "?") {
      return { valid: false, invalidLine: invalidLine("Missing language header. First line must be: ? / source-code / target-code") };
    }
    const source = languageByCode(parts[1]);
    const target = languageByCode(parts[2]);
    if (!source) return { valid: false, invalidLine: invalidLine(`Unknown language code "${parts[1]}". Create pairs using the language picker.`) };
    if (!target) return { valid: false, invalidLine: invalidLine(`Unknown language code "${parts[2]}". Create pairs using the language picker.`) };
    if (source.code === target.code) return { valid: false, invalidLine: invalidLine("Source and target languages must be different.") };
    const languagePairId = canonicalPairId(source.code, target.code);
    if (languagePairs.length && !languagePairs.some((pair) => pair.id === languagePairId)) {
      return { valid: false, invalidLine: invalidLine(`Create ${languageLabel(source.code)}-${languageLabel(target.code)} in Library before importing this file.`) };
    }
    return {
      valid: true,
      languagePairId,
      sourceLanguage: source.code,
      targetLanguage: target.code,
    };
  }

  parseLine(line, datasetId, lineNumber = 1) {
    const originalText = String(line ?? "");
    const trimmed = originalText.trim();
    if (!trimmed) return null;

    const ignoredRemoved = trimmed.split("&")[0].trim();
    const parts = ignoredRemoved.split("/").map((field) => field.trim());

    const invalid = (error) => ({
      id: uid("invalid"),
      datasetId,
      lineNumber,
      originalText,
      error,
      editedText: originalText,
    });

    if (parts.length < 3) return invalid("Missing required fields. Use: type / source / target");
    if (/^[-*•]/.test(trimmed)) return invalid("Bullets are not valid vocabulary lines.");
    if (/^\d+\.\s/.test(trimmed)) return invalid("Numbered lines are not valid. Use a numeric type followed by /.");

    const typeCode = Number(parts[0]);
    if (!Number.isInteger(typeCode) || typeCode < 1 || typeCode > 6) {
      return invalid("Invalid type code. Use 1, 2, 3, 4, 5, or 6.");
    }
    if (!parts[1]) return invalid("Missing source field.");
    if (!parts[2]) return invalid("Missing target field.");

    const optionalText = parts.slice(3).join(" / ");
    return createEntry({
      datasetId,
      typeCode,
      spanish: parts[1],
      english: parts[2],
      details: typeCode === 2 ? "" : optionalText,
      conjugation: typeCode === 2 ? optionalText : "",
    });
  }
}

function conflictId(entry, suffix = "") {
  return `conflict_${entry.id}${suffix ? `_${suffix}` : ""}`;
}

function similar(a, b) {
  if (!a || !b || a === b) return false;
  return a.includes(b) || b.includes(a) || levenshtein(a, b) <= Math.max(2, Math.floor(Math.max(a.length, b.length) * 0.25));
}

function levenshtein(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return rows[a.length][b.length];
}

export class DuplicateDetector {
  checkWithinDataset(entries) {
    const conflicts = [];
    const seen = new Map();
    entries.forEach((entry) => {
      const key = entryKey(entry);
      const previous = seen.get(key);
      if (previous) {
        conflicts.push({
          id: conflictId(entry, "same_dataset"),
          severity: "error",
          reason: "This word already exists with the same type, source, and target.",
          incomingEntry: entry,
          sameDatasetEntry: previous,
          status: "unresolved",
        });
      } else {
        seen.set(key, entry);
      }
    });

    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const first = entries[i];
        const second = entries[j];
        if (entryKey(first) === entryKey(second)) continue;
        if (this.looksSimilar(first, second)) {
          conflicts.push({
            id: conflictId(second, `warning_${i}`),
            severity: "warning",
            reason: "This looks similar to another word in this import. Please confirm or edit.",
            incomingEntry: second,
            sameDatasetEntry: first,
            status: "unresolved",
          });
        }
      }
    }
    return conflicts;
  }

  checkAgainstExisting(entries, existingEntries) {
    const existingByKey = new Map(existingEntries.map((entry) => [entryKey(entry), entry]));
    const conflicts = [];
    entries.forEach((entry) => {
      const exact = existingByKey.get(entryKey(entry));
      if (exact) {
        conflicts.push({
          id: conflictId(entry, "existing"),
          severity: "error",
          reason: "This word already exists with the same type, source, and target.",
          incomingEntry: entry,
          existingEntry: exact,
          status: "unresolved",
        });
        return;
      }
      const near = existingEntries.find((existing) => this.looksSimilar(entry, existing));
      if (near) {
        conflicts.push({
          id: conflictId(entry, "near_existing"),
          severity: "warning",
          reason: "This looks similar to an existing word. Please confirm or edit.",
          incomingEntry: entry,
          existingEntry: near,
          status: "unresolved",
        });
      }
    });
    return conflicts;
  }

  looksSimilar(a, b) {
    const sameType = a.normalizedType === b.normalizedType;
    const sameSpanish = a.normalizedSpanish === b.normalizedSpanish;
    const sameEnglish = a.normalizedEnglish === b.normalizedEnglish;
    return (sameType && sameSpanish) || (sameType && sameEnglish) || (sameSpanish && sameEnglish);
  }
}

function shuffleRandom(entries) {
  if (entries.length <= 1) return [...entries];
  const originalIds = entries.map((entry) => entry.id);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const shuffled = [...entries];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    if (!shuffled.every((entry, index) => entry.id === originalIds[index])) return shuffled;
  }
  return [...entries.slice(1), entries[0]];
}

export function filterEntries(entries, config) {
  const typeFilters = new Set(config.typeFilters?.length ? config.typeFilters.map(Number) : Object.keys(TYPE_CODE_MAP).map(Number));
  const query = normalizeText(config.searchQuery ?? "");
  let visible = entries.filter((entry) => {
    if (!typeFilters.has(entry.typeCode)) return false;
    if (!config.includeMastered && entry.masteryCount >= 5) return false;
    if (!query) return true;
    return [entry.spanish, entry.english, entry.details, conjugationText(entry), TYPE_CODE_MAP[entry.typeCode]].some((value) => normalizeText(value).includes(query));
  });
  if (config.order === "shuffle") visible = shuffleStable(visible);
  return visible;
}

function shuffleStable(entries) {
  return [...entries]
    .map((entry) => ({ entry, sort: seededNumber(entry.id) }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ entry }) => entry);
}

function seededNumber(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash / 4294967295;
}

export function makeQuizSession(config, entries) {
  const time = nowIso();
  const deduped = dedupeEligibleEntries(entries, config);
  const queue = shuffleRandom(deduped).map((entry) => quizItemForEntry(entry, config.direction));
  return {
    id: uid("quiz"),
    languagePairId: config.languagePairId,
    selectedDatasetIds: config.datasetIds,
    direction: config.direction,
    includeMastered: config.includeMastered,
    typeFilters: config.typeFilters,
    queue,
    currentItemId: queue[0]?.id,
    roundSeenEntryKeys: [],
    sessionScores: Object.fromEntries(queue.map((item) => [item.entryKey, 0])),
    createdAt: time,
    updatedAt: time,
  };
}

export function dedupeEligibleEntries(entries, config, sessionScores = {}) {
  const typeFilters = new Set(config.typeFilters?.length ? config.typeFilters.map(Number) : Object.keys(TYPE_CODE_MAP).map(Number));
  const deduped = new Map();
  entries.forEach((entry) => {
    if (!typeFilters.has(entry.typeCode)) return;
    if (!config.includeMastered && entry.masteryCount >= 5) return;
    const key = entryKey(entry);
    if (sessionScores[key] >= 5) return;
    if (!deduped.has(key)) deduped.set(key, entry);
  });
  return [...deduped.values()];
}

export function quizItemForEntry(entry, directionMode) {
  const direction = directionMode === "mixed"
    ? (Math.random() > 0.5 ? "spanish-to-english" : "english-to-spanish")
    : directionMode;
  return {
    id: uid("item"),
    entryId: entry.id,
    entryKey: entryKey(entry),
    datasetId: entry.datasetId,
    direction,
    revealLevel: 0,
  };
}

export function promptFor(item, entry) {
  return item.direction === "spanish-to-english" ? entry.spanish : entry.english;
}

export function answerFor(item, entry) {
  return item.direction === "spanish-to-english" ? entry.english : entry.spanish;
}

export function canShowVerbDetails(entry) {
  return entry.typeCode === 2 && Boolean(conjugationText(entry));
}

export function conjugationText(entry) {
  return entry?.typeCode === 2 ? entry?.conjugation?.raw?.trim() || "" : "";
}

export function applySettingsToDocument(settings) {
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.dataset.fontSize = settings.fontSize;
  root.dataset.background = settings.background || DEFAULT_SETTINGS.background;
  root.style.setProperty("--app-font", settings.fontFamily || DEFAULT_SETTINGS.fontFamily);
}
