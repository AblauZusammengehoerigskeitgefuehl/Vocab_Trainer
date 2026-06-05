// @ts-nocheck
import { canonicalPairId, DEFAULT_SETTINGS, DuplicateDetector, languageLabel, VocabularyParser, nowIso, } from "./core.js";
import { DatasetRepository, DuplicateConflictRepository, InvalidLineRepository, LanguagePairRepository, QuizSessionRepository, SettingsRepository, VocabularyRepository, } from "./storage.js";
export function emptyManualRow() {
    return { typeCode: 6, spanish: "", english: "", details: "", conjugation: "" };
}
export function emptyEditRow(datasetId) {
    return { datasetId, typeCode: 6, spanish: "", english: "", details: "", conjugation: "", masteryCount: 0 };
}
export class AppContext {
    constructor(app) {
        this.app = app;
        this.parser = new VocabularyParser();
        this.duplicateDetector = new DuplicateDetector();
        this.languagePairsRepo = new LanguagePairRepository();
        this.datasetsRepo = new DatasetRepository();
        this.vocabRepo = new VocabularyRepository();
        this.invalidRepo = new InvalidLineRepository();
        this.conflictRepo = new DuplicateConflictRepository();
        this.quizRepo = new QuizSessionRepository();
        this.settingsRepo = new SettingsRepository();
        this.visibleRoute = null;
        this.state = {
            route: "notes",
            languagePairs: [],
            activeLanguagePairId: null,
            datasets: [],
            entries: [],
            invalidLines: [],
            conflicts: [],
            selectedDatasetId: null,
            preview: null,
            noteEditorMode: "new",
            editDatasetId: null,
            editTitle: "",
            editRows: [],
            deletedEntryIds: [],
            manualTitle: "Manual Vocabulary",
            manualRows: [emptyManualRow()],
            libraryDatasetsOpen: false,
            libraryImportOpen: false,
            libraryDatasetSearch: "",
            pairLanguageSearchA: "",
            pairLanguageSearchB: "",
            learn: {
                datasetIds: "all",
                typeFilters: [1, 2, 3, 4, 5, 6],
                includeMastered: false,
                searchQuery: "",
                order: "original",
                direction: "spanish-to-english",
            },
            blurredColumns: new Set(),
            quizConfig: {
                datasetIds: [],
                typeFilters: [1, 2, 3, 4, 5, 6],
                includeMastered: false,
                direction: "mixed",
            },
            quizSession: null,
            settings: DEFAULT_SETTINGS,
            message: "",
            shortcutHelp: false,
            quizFiltersOpen: false,
            learnFiltersOpen: false,
            quizFocusMode: false,
        };
    }
    async refreshAll() {
        const { state } = this;
        state.languagePairs = await this.languagePairsRepo.list();
        const allDatasets = await this.datasetsRepo.list();
        await this.ensureLegacyPair(allDatasets);
        state.languagePairs = await this.languagePairsRepo.list();
        if (!state.activeLanguagePairId)
            state.activeLanguagePairId = state.settings.activeLanguagePairId ?? null;
        if (state.activeLanguagePairId && !state.languagePairs.some((pair) => pair.id === state.activeLanguagePairId)) {
            state.activeLanguagePairId = null;
        }
        if (!state.activeLanguagePairId && state.languagePairs[0])
            state.activeLanguagePairId = state.languagePairs[0].id;
        const refreshedDatasets = await this.datasetsRepo.list();
        state.datasets = state.activeLanguagePairId
            ? refreshedDatasets.filter((dataset) => dataset.languagePairId === state.activeLanguagePairId)
            : [];
        const activeDatasetIds = new Set(state.datasets.map((dataset) => dataset.id));
        state.entries = (await this.vocabRepo.getAll()).filter((entry) => activeDatasetIds.has(entry.datasetId));
        state.quizSession = await this.quizRepo.getActive();
        if (state.selectedDatasetId && !activeDatasetIds.has(state.selectedDatasetId))
            state.selectedDatasetId = null;
        if (!state.selectedDatasetId && state.datasets[0])
            state.selectedDatasetId = state.datasets[0].id;
        const existingDatasetIds = new Set(state.datasets.map((dataset) => dataset.id));
        const sessionUsesActivePair = state.quizSession?.languagePairId === state.activeLanguagePairId
            || !state.quizSession?.languagePairId;
        if (state.quizSession && sessionUsesActivePair) {
            state.quizConfig = {
                datasetIds: state.quizSession.selectedDatasetIds.filter((id) => existingDatasetIds.has(id)),
                typeFilters: state.quizSession.typeFilters,
                includeMastered: state.quizSession.includeMastered,
                direction: state.quizSession.direction,
            };
        }
        else if (state.quizSession && !sessionUsesActivePair) {
            await this.quizRepo.clearActive();
            state.quizSession = null;
        }
        else if (!state.quizConfig.datasetIds.length) {
            state.quizConfig.datasetIds = state.datasets.map((dataset) => dataset.id);
        }
        else {
            state.quizConfig.datasetIds = state.quizConfig.datasetIds.filter((id) => existingDatasetIds.has(id));
        }
        if (state.selectedDatasetId) {
            state.invalidLines = await this.invalidRepo.listByDataset(state.selectedDatasetId);
            state.conflicts = await this.conflictRepo.listByDataset(state.selectedDatasetId);
        }
    }
    async ensureLegacyPair(datasets) {
        const legacyDatasets = datasets.filter((dataset) => !dataset.languagePairId);
        if (!legacyDatasets.length)
            return;
        const defaultPairId = canonicalPairId("es", "en");
        const existing = await this.languagePairsRepo.get(defaultPairId);
        const time = nowIso();
        if (!existing) {
            await this.languagePairsRepo.create({
                id: defaultPairId,
                sourceLanguage: "es",
                targetLanguage: "en",
                title: `${languageLabel("es")}-${languageLabel("en")}`,
                createdAt: time,
                updatedAt: time,
            });
        }
        for (const dataset of legacyDatasets) {
            await this.datasetsRepo.update({
                ...dataset,
                languagePairId: defaultPairId,
                sourceLanguage: dataset.sourceLanguage ?? "es",
                targetLanguage: dataset.targetLanguage ?? "en",
                updatedAt: dataset.updatedAt ?? time,
            });
        }
    }
}
