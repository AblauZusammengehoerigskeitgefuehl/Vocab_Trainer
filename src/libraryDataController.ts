// @ts-nocheck
import {
  conjugationText,
  createEntry,
  nowIso,
  uid,
} from "./core.js";
import { emptyManualRow } from "./appContext.js";

export class LibraryDataController {
  constructor(context) {
    this.context = context;
    this.state = context.state;
    this.parser = context.parser;
    this.duplicateDetector = context.duplicateDetector;
    this.datasetsRepo = context.datasetsRepo;
    this.vocabRepo = context.vocabRepo;
    this.invalidRepo = context.invalidRepo;
    this.conflictRepo = context.conflictRepo;
    this.quizRepo = context.quizRepo;
  }

  async loadFilePreview(file) {
    if (!this.state.activeLanguagePairId) {
      this.state.message = "Create or choose a language pair before importing.";
      return;
    }
    const datasetId = uid("dataset");
    const text = await this.extractText(file);
    if (!text.trim()) {
      this.state.message = "No readable text found. Please upload a text-based PDF.";
      return;
    }
    const parsed = this.parser.parseText(text, datasetId, { languagePairs: this.state.languagePairs });
    if (parsed.header && parsed.header.languagePairId !== this.state.activeLanguagePairId) {
      parsed.invalidLines.unshift({
        id: uid("invalid"),
        datasetId,
        lineNumber: 1,
        originalText: text.split(/\r?\n/)[0] ?? "",
        error: "This file belongs to another language pair. Switch to that pair before importing.",
        editedText: text.split(/\r?\n/)[0] ?? "",
      });
      parsed.entries = [];
    }
    if (!parsed.entries.length) this.state.message = "No valid vocabulary lines found.";
    const activeDatasetIds = new Set(this.state.datasets.map((dataset) => dataset.id));
    const existing = (await this.vocabRepo.getAll()).filter((entry) => activeDatasetIds.has(entry.datasetId));
    const duplicateConflicts = [
      ...this.duplicateDetector.checkWithinDataset(parsed.entries),
      ...this.duplicateDetector.checkAgainstExisting(parsed.entries, existing),
    ];
    const time = nowIso();
    this.state.preview = {
      dataset: {
        id: datasetId,
        title: file.name.replace(/\.[^.]+$/, "") || "Imported Vocabulary",
        originalFileName: file.name,
        sourceType: this.sourceTypeFromFile(file),
        languagePairId: parsed.header?.languagePairId ?? this.state.activeLanguagePairId,
        sourceLanguage: parsed.header?.sourceLanguage,
        targetLanguage: parsed.header?.targetLanguage,
        status: this.statusForPreview(parsed.invalidLines, duplicateConflicts),
        createdAt: time,
        updatedAt: time,
      },
      entries: parsed.entries,
      invalidLines: parsed.invalidLines,
      duplicateConflicts,
    };
  }

  async extractText(file) {
    if (file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf") {
      try {
        const pdfjsLib = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/+esm");
        const bytes = new Uint8Array(await file.arrayBuffer());
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        let text = "";
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const content = await page.getTextContent();
          text += `${content.items.map((item) => item.str).join("\n")}\n`;
        }
        return text;
      } catch {
        return "";
      }
    }
    return file.text();
  }

  async confirmImport() {
    if (!this.state.preview || this.previewHasBlockingErrors()) return;
    if (this.state.preview.mode === "edit") {
      await this.confirmEditedPreview();
      return;
    }
    await this.datasetsRepo.create({ ...this.state.preview.dataset, status: "ready", updatedAt: nowIso() });
    await this.vocabRepo.addMany(this.state.preview.entries);
    await this.invalidRepo.addMany(this.state.preview.invalidLines);
    await this.conflictRepo.addMany(this.state.preview.duplicateConflicts, this.state.preview.dataset.id);
    this.state.selectedDatasetId = this.state.preview.dataset.id;
    if (!this.state.quizSession && !this.state.quizConfig.datasetIds.includes(this.state.preview.dataset.id)) {
      this.state.quizConfig.datasetIds = [...this.state.quizConfig.datasetIds, this.state.preview.dataset.id];
    }
    this.state.preview = null;
    this.state.message = "Dataset saved.";
  }

  async confirmEditedPreview() {
    const dataset = await this.datasetsRepo.get(this.state.preview.dataset.id);
    if (!dataset) {
      this.state.preview = null;
      this.state.message = "The edited dataset no longer exists.";
      return;
    }
    await this.datasetsRepo.update({ ...dataset, title: this.state.preview.dataset.title, status: "ready", updatedAt: nowIso() });
    for (const id of this.state.deletedEntryIds) await this.vocabRepo.delete(id);
    await this.vocabRepo.addMany(this.state.preview.entries);
    await this.conflictRepo.replaceByDataset(this.state.preview.duplicateConflicts, dataset.id);
    this.state.selectedDatasetId = dataset.id;
    this.state.deletedEntryIds = [];
    this.state.preview = null;
    this.state.message = "Dataset updated.";
  }

  async reparseInvalid(id) {
    const line = this.state.preview?.invalidLines.find((item) => item.id === id);
    if (!line) {
      const savedLine = this.state.invalidLines.find((item) => item.id === id);
      if (!savedLine) return;
      const parsed = this.parser.parseLine(savedLine.editedText ?? savedLine.originalText, savedLine.datasetId, savedLine.lineNumber);
      if (parsed && !("error" in parsed)) {
        await this.vocabRepo.addMany([parsed]);
        await this.invalidRepo.delete(id);
        this.state.message = "Invalid line repaired and saved.";
      } else if (parsed) {
        this.state.message = parsed.error;
      }
      return;
    }
    const parsed = this.parser.parseLine(line.editedText ?? line.originalText, line.datasetId, line.lineNumber);
    if (parsed && !("error" in parsed)) {
      this.state.preview.entries.push(parsed);
      this.state.preview.invalidLines = this.state.preview.invalidLines.filter((item) => item.id !== id);
      this.recomputePreviewConflicts();
    } else if (parsed) {
      line.error = parsed.error;
    }
  }

  recomputePreviewConflicts() {
    if (!this.state.preview) return;
    const existingEntries = this.state.entries.filter((entry) => entry.datasetId !== this.state.preview.dataset.id);
    this.state.preview.duplicateConflicts = [
      ...this.duplicateDetector.checkWithinDataset(this.state.preview.entries),
      ...this.duplicateDetector.checkAgainstExisting(this.state.preview.entries, existingEntries),
    ];
  }

  async skipInvalid(id) {
    if (this.state.preview) this.state.preview.invalidLines = this.state.preview.invalidLines.filter((line) => line.id !== id);
    else await this.invalidRepo.delete(id);
  }

  keepConflict(id) {
    if (!this.state.preview) return;
    const conflict = this.state.preview.duplicateConflicts.find((item) => item.id === id);
    if (!conflict) return;
    this.state.preview.duplicateConflicts = this.state.preview.duplicateConflicts.filter((item) => item.incomingEntry.id !== conflict.incomingEntry.id);
  }

  discardConflict(id) {
    if (!this.state.preview) return;
    const conflict = this.state.preview.duplicateConflicts.find((item) => item.id === id);
    if (!conflict) return;
    this.discardIncomingEntry(conflict.incomingEntry.id);
  }

  keepAllConflicts() {
    if (!this.state.preview) return;
    this.state.preview.duplicateConflicts = [];
  }

  discardAllConflicts() {
    if (!this.state.preview) return;
    const entryIds = new Set(this.state.preview.duplicateConflicts.map((conflict) => conflict.incomingEntry.id));
    entryIds.forEach((entryId) => this.discardIncomingEntry(entryId));
  }

  keepAllWarningConflicts() {
    if (!this.state.preview) return;
    this.state.preview.duplicateConflicts = this.state.preview.duplicateConflicts.filter((conflict) => conflict.severity !== "warning");
  }

  discardAllWarningConflicts() {
    if (!this.state.preview) return;
    const warningEntryIds = new Set(this.state.preview.duplicateConflicts
      .filter((conflict) => conflict.severity === "warning")
      .map((conflict) => conflict.incomingEntry.id));
    warningEntryIds.forEach((entryId) => this.discardIncomingEntry(entryId));
  }

  discardIncomingEntry(entryId) {
    if (!this.state.preview) return;
    this.state.preview.entries = this.state.preview.entries.filter((entry) => entry.id !== entryId);
    this.state.preview.duplicateConflicts = this.state.preview.duplicateConflicts.filter((conflict) => (
      conflict.incomingEntry.id !== entryId
      && conflict.sameDatasetEntry?.id !== entryId
      && conflict.existingEntry?.id !== entryId
    ));
  }

  async saveManual() {
    if (!this.state.activeLanguagePairId) {
      this.state.message = "Create or choose a language pair before saving a dataset.";
      return;
    }
    const title = this.state.manualTitle.trim() || "Manual Vocabulary";
    const datasetId = uid("dataset");
    const pair = this.state.languagePairs.find((item) => item.id === this.state.activeLanguagePairId);
    const entries = this.state.manualRows
      .filter((row) => row.spanish.trim() && row.english.trim())
      .map((row) => ({
        ...createEntry({ ...row, datasetId }),
        languagePairId: this.state.activeLanguagePairId,
        sourceLanguage: pair?.sourceLanguage,
        targetLanguage: pair?.targetLanguage,
      }));
    if (!entries.length) {
      this.state.message = "No valid vocabulary lines found.";
      return;
    }
    const conflicts = [
      ...this.duplicateDetector.checkWithinDataset(entries),
      ...this.duplicateDetector.checkAgainstExisting(entries, this.state.entries),
    ];
    if (conflicts.length) {
      this.state.preview = {
        dataset: this.datasetForManual(datasetId, title, "has_conflicts"),
        entries,
        invalidLines: [],
        duplicateConflicts: conflicts,
      };
      this.state.message = "This file contains duplicate conflicts. Please resolve them before saving.";
      return;
    }
    await this.datasetsRepo.create(this.datasetForManual(datasetId, title, "ready"));
    await this.vocabRepo.addMany(entries);
    await this.conflictRepo.addMany(conflicts, datasetId);
    this.state.manualTitle = "Manual Vocabulary";
    this.state.manualRows = [emptyManualRow()];
    this.state.selectedDatasetId = datasetId;
    if (!this.state.quizSession && !this.state.quizConfig.datasetIds.includes(datasetId)) {
      this.state.quizConfig.datasetIds = [...this.state.quizConfig.datasetIds, datasetId];
    }
    this.state.message = "Manual dataset saved.";
  }

  async saveExisting() {
    const dataset = await this.datasetsRepo.get(this.state.editDatasetId);
    if (!dataset) {
      this.state.message = "Choose a dataset before saving changes.";
      return;
    }
    const validRows = this.state.editRows.filter((row) => row.spanish.trim() && row.english.trim());
    if (!validRows.length) {
      this.state.message = "A dataset needs at least one valid word.";
      return;
    }
    const time = nowIso();
    const entries = validRows.map((row) => {
      if (row.id) return this.normalizeEditedEntry({ ...row, datasetId: dataset.id, updatedAt: time });
      return createEntry({ ...row, datasetId: dataset.id });
    }).map((entry) => ({
      ...entry,
      languagePairId: dataset.languagePairId,
      sourceLanguage: dataset.sourceLanguage,
      targetLanguage: dataset.targetLanguage,
    }));
    const activeDatasetIds = new Set(this.state.datasets.map((item) => item.id));
    const otherEntries = (await this.vocabRepo.getAll()).filter((entry) => activeDatasetIds.has(entry.datasetId) && entry.datasetId !== dataset.id);
    const conflicts = [
      ...this.duplicateDetector.checkWithinDataset(entries),
      ...this.duplicateDetector.checkAgainstExisting(entries, otherEntries),
    ];
    if (conflicts.length) {
      this.state.preview = {
        mode: "edit",
        dataset: { ...dataset, title: this.state.editTitle.trim() || dataset.title, status: "has_conflicts", updatedAt: time },
        entries,
        invalidLines: [],
        duplicateConflicts: conflicts,
      };
      this.state.message = "This edit creates duplicate conflicts. Please resolve them before saving.";
      return;
    }
    await this.datasetsRepo.update({ ...dataset, title: this.state.editTitle.trim() || dataset.title, updatedAt: time });
    for (const id of this.state.deletedEntryIds) await this.vocabRepo.delete(id);
    await this.vocabRepo.addMany(entries);
    await this.conflictRepo.replaceByDataset(conflicts, dataset.id);
    this.state.deletedEntryIds = [];
    this.state.message = "Dataset updated.";
    await this.context.refreshAll();
    this.loadExistingDataset(dataset.id);
  }

  loadExistingDataset(datasetId) {
    const dataset = this.state.datasets.find((item) => item.id === datasetId);
    this.state.editDatasetId = dataset?.id ?? null;
    this.state.editTitle = dataset?.title ?? "";
    this.state.deletedEntryIds = [];
    this.state.editRows = dataset
      ? this.state.entries.filter((entry) => entry.datasetId === dataset.id).map((entry) => this.entryToEditRow(entry))
      : [];
  }

  entryToEditRow(entry) {
    return {
      id: entry.id,
      datasetId: entry.datasetId,
      typeCode: entry.typeCode,
      spanish: entry.spanish,
      english: entry.english,
      details: entry.details ?? "",
      conjugation: conjugationText(entry),
      normalizedType: entry.normalizedType,
      normalizedSpanish: entry.normalizedSpanish,
      normalizedEnglish: entry.normalizedEnglish,
      masteryCount: entry.masteryCount ?? 0,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }

  normalizeEditedEntry(row) {
    const base = createEntry({
      datasetId: row.datasetId,
      typeCode: row.typeCode,
      spanish: row.spanish,
      english: row.english,
      details: row.details,
      conjugation: row.conjugation,
    });
    return {
      ...base,
      id: row.id,
      masteryCount: row.masteryCount ?? 0,
      createdAt: row.createdAt ?? base.createdAt,
      updatedAt: row.updatedAt ?? base.updatedAt,
    };
  }

  removeExistingRow(index) {
    const [row] = this.state.editRows.splice(index, 1);
    if (row?.id) this.state.deletedEntryIds.push(row.id);
  }

  datasetForManual(id, title, status) {
    const time = nowIso();
    const pair = this.state.languagePairs.find((item) => item.id === this.state.activeLanguagePairId);
    return {
      id,
      title,
      sourceType: "manual",
      languagePairId: this.state.activeLanguagePairId,
      sourceLanguage: pair?.sourceLanguage,
      targetLanguage: pair?.targetLanguage,
      status,
      createdAt: time,
      updatedAt: time,
    };
  }

  async deleteDataset(datasetId) {
    if (!confirm("Delete dataset? This cannot be undone.")) return false;
    const activeQuizUsesDataset = this.state.quizSession?.selectedDatasetIds.includes(datasetId)
      || this.state.quizSession?.queue.some((item) => item.datasetId === datasetId);
    await this.datasetsRepo.delete(datasetId);
    if (activeQuizUsesDataset) await this.quizRepo.clearActive();
    this.state.selectedDatasetId = null;
    this.state.quizConfig.datasetIds = this.state.quizConfig.datasetIds.filter((id) => id !== datasetId);
    this.state.message = "Dataset deleted.";
    return true;
  }

  previewHasBlockingErrors() {
    return Boolean(this.state.preview?.invalidLines.length || this.state.preview?.duplicateConflicts.length);
  }

  statusForPreview(invalidLines, conflicts) {
    if (conflicts.some((conflict) => conflict.severity === "error")) return "has_conflicts";
    if (invalidLines.length) return "has_errors";
    return "ready";
  }

  sourceTypeFromFile(file) {
    const ext = file.name.toLowerCase().split(".").pop();
    if (["pdf", "txt", "csv", "tsv", "json"].includes(ext)) return ext;
    return "txt";
  }
}
