import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalPairId,
  DuplicateDetector,
  VocabularyParser,
  canShowVerbDetails,
  createEntry,
  dedupeEligibleEntries,
  entryKey,
  filterEntries,
  makeQuizSession,
} from "../dist/core.js";

const pairs = [{ id: canonicalPairId("es", "en"), sourceLanguage: "es", targetLanguage: "en" }];

test("valid slash-delimited verb stores conjugation and usage sentence", () => {
  const parser = new VocabularyParser();
  const result = parser.parseLine("2 / hablar / to speak / present: hablo / hablo español todos los días", "d1", 1);
  assert.equal(result.typeCode, 2);
  assert.equal(result.spanish, "hablar");
  assert.equal(result.english, "to speak");
  assert.equal(result.details, "hablo español todos los días");
  assert.deepEqual(result.conjugation, { raw: "present: hablo" });
});

test("ampersand import notes are invalid", () => {
  const parser = new VocabularyParser();
  const result = parser.parseLine("1 / la casa / house & example: mi casa es pequeña", "d1", 1);
  assert.match(result.error, /Ampersands are not supported/);
});

test("invalid lines are returned with reasons", () => {
  const parser = new VocabularyParser();
  const result = parser.parseText("? / es / en\nhablar / to speak\n9 / hablar / to speak\n2 / / to speak", "d1", { languagePairs: pairs });
  assert.equal(result.entries.length, 0);
  assert.equal(result.invalidLines.length, 3);
  assert.match(result.invalidLines[1].error, /Invalid type/);
});

test("imports require usage sentence details", () => {
  const parser = new VocabularyParser();
  const noun = parser.parseLine("1 / la casa / house", "d1", 1);
  const verb = parser.parseLine("2 / hablar / to speak / present: hablo", "d1", 2);
  assert.match(noun.error, /Non-verb lines must use exactly/);
  assert.match(verb.error, /Verb lines must use exactly/);
});

test("missing language header blocks imports", () => {
  const parser = new VocabularyParser();
  const result = parser.parseText("1 / casa / house", "d1", { languagePairs: pairs });
  assert.equal(result.entries.length, 0);
  assert.equal(result.invalidLines.length, 1);
  assert.match(result.invalidLines[0].error, /Missing language header/);
});

test("language header attaches pair and direction metadata", () => {
  const parser = new VocabularyParser();
  const result = parser.parseText("? / es / en\n1 / casa / house / mi casa es pequeña", "d1", { languagePairs: pairs });
  assert.equal(result.invalidLines.length, 0);
  assert.equal(result.entries[0].languagePairId, "en-es");
  assert.equal(result.entries[0].sourceLanguage, "es");
  assert.equal(result.entries[0].targetLanguage, "en");
});

test("exact duplicate type spanish english is an error and details do not matter", () => {
  const entries = [
    createEntry({ datasetId: "d1", typeCode: 2, spanish: "hablar", english: "to speak", details: "present" }),
    createEntry({ datasetId: "d1", typeCode: 2, spanish: "hablar", english: "to speak", details: "preterite" }),
  ];
  const conflicts = new DuplicateDetector().checkWithinDataset(entries);
  assert.equal(conflicts[0].severity, "error");
});

test("similar spanish or english causes warning", () => {
  const entries = [
    createEntry({ datasetId: "d1", typeCode: 2, spanish: "hablar", english: "to speak" }),
    createEntry({ datasetId: "d1", typeCode: 2, spanish: "hablar", english: "speak" }),
  ];
  const conflicts = new DuplicateDetector().checkWithinDataset(entries);
  assert.equal(conflicts.some((conflict) => conflict.severity === "warning"), true);
});

test("any two matching identity fields causes warning", () => {
  const entries = [
    createEntry({ datasetId: "d1", typeCode: 2, spanish: "cocinar", english: "to cook" }),
    createEntry({ datasetId: "d1", typeCode: 2, spanish: "preparar", english: "to cook" }),
    createEntry({ datasetId: "d1", typeCode: 1, spanish: "cocinar", english: "to cook" }),
  ];
  const conflicts = new DuplicateDetector().checkWithinDataset(entries);
  assert.equal(conflicts.filter((conflict) => conflict.severity === "warning").length >= 2, true);
});

test("verb without details skips details reveal", () => {
  const entry = createEntry({ datasetId: "d1", typeCode: 2, spanish: "vivir", english: "to live" });
  assert.equal(canShowVerbDetails(entry), false);
});

test("conjugation object is only added for verbs", () => {
  const verb = createEntry({ datasetId: "d1", typeCode: 2, spanish: "hablar", english: "to speak", conjugation: "present: hablo" });
  const noun = createEntry({ datasetId: "d1", typeCode: 1, spanish: "casa", english: "house", conjugation: "not used" });
  assert.deepEqual(verb.conjugation, { raw: "present: hablo" });
  assert.equal(noun.conjugation, undefined);
});

test("mastery count excludes by default in learn and quiz", () => {
  const mastered = createEntry({ datasetId: "d1", typeCode: 1, spanish: "casa", english: "house" });
  mastered.masteryCount = 5;
  const fresh = createEntry({ datasetId: "d1", typeCode: 1, spanish: "año", english: "year" });
  const config = { typeFilters: [1], includeMastered: false, searchQuery: "", order: "original" };
  assert.deepEqual(filterEntries([mastered, fresh], config).map((entry) => entry.spanish), ["año"]);
  assert.deepEqual(dedupeEligibleEntries([mastered, fresh], { ...config, datasetIds: ["d1"], direction: "mixed" }).map((entry) => entry.spanish), ["año"]);
});

test("+5 removes from queue and increments session score key", () => {
  const entry = createEntry({ datasetId: "d1", typeCode: 1, spanish: "casa", english: "house" });
  const session = makeQuizSession({ datasetIds: ["d1"], typeFilters: [1], includeMastered: false, direction: "spanish-to-english" }, [entry]);
  const key = entryKey(entry);
  for (let i = 0; i < 5; i += 1) session.sessionScores[key] += 1;
  const queue = session.queue.filter((item) => session.sessionScores[item.entryKey] < 5);
  assert.equal(session.sessionScores[key], 5);
  assert.equal(queue.length, 0);
});

test("combined quiz dedupes by canonical key", () => {
  const first = createEntry({ datasetId: "d1", typeCode: 1, spanish: "casa", english: "house" });
  const second = createEntry({ datasetId: "d2", typeCode: 1, spanish: " casa ", english: "House" });
  const session = makeQuizSession({ datasetIds: ["d1", "d2"], typeFilters: [1], includeMastered: true, direction: "mixed" }, [first, second]);
  assert.equal(session.queue.length, 1);
});
