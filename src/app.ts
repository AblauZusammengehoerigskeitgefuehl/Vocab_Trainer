// @ts-nocheck
import {
  LANGUAGE_REGISTRY,
  TYPE_CODE_MAP,
  TYPE_OPTIONS,
  applySettingsToDocument,
  canonicalPairId,
  languageByName,
  languageLabel,
  nowIso,
  pairLabel,
} from "./core.js";
import { AppContext, emptyEditRow, emptyManualRow } from "./appContext.js";
import { AppEventRouter } from "./appEventRouter.js";
import { AppShellRenderer } from "./appShellRenderer.js";
import { LearnController } from "./learnController.js";
import { LibraryDataController } from "./libraryDataController.js";
import { LibraryController } from "./libraryController.js";
import { QuizController } from "./quizController.js";
import { QuizSessionController } from "./quizSessionController.js";

const context = new AppContext(document.querySelector("#app"));
const {
  app,
  state,
  datasetsRepo,
  languagePairsRepo,
  settingsRepo,
} = context;
const shellRenderer = new AppShellRenderer(context, {
  routeView,
  renderQuizFocus,
  escapeHtml,
});
const libraryDataController = new LibraryDataController(context);
const libraryController = new LibraryController(context, {
  updateMessageView,
  openDatasetInLearn,
  loadExistingDataset,
  refreshAll,
  reparseInvalid,
  skipInvalid,
  keepConflict,
  discardConflict,
  keepAllConflicts,
  discardAllConflicts,
  keepAllWarningConflicts,
  discardAllWarningConflicts,
  removeExistingRow,
  confirmImport,
  saveManual,
  saveExisting,
  deleteDataset,
  createLanguagePair,
  escapeHtml,
  escapeAttr,
  entryLabel,
  languageOptions,
  activePairLabel,
  sourceLabel,
  targetLabel,
});
const learnController = new LearnController(context, {
  filterDrawerView,
  syncDatasetControls,
  labelForColumn,
  formatConjugation,
  escapeHtml,
});
const quizSessionController = new QuizSessionController(context);
const quizController = new QuizController(context, {
  filterDrawerView,
  syncDatasetControls,
  currentItem,
  render,
  formatConjugation,
  escapeHtml,
});
const eventRouter = new AppEventRouter(context, {
  onClick,
  onDoubleClick,
  onChange,
  onInput,
  onKeydown,
});

init();

async function init() {
  state.settings = await settingsRepo.get();
  applySettingsToDocument(state.settings);
  await refreshAll();
  bindEvents();
  render();
}

async function refreshAll() {
  await context.refreshAll();
}

function bindEvents() {
  eventRouter.bind();
}

function render() {
  shellRenderer.render();
}

function updateMessageView() {
  shellRenderer.updateMessageView();
}

function routeView() {
  if (state.route === "learn") return learnView();
  if (state.route === "quiz") return quizView();
  if (state.route === "notes") return notesView();
  if (state.route === "settings") return settingsView();
  return notesView();
}

function notesView() {
  return libraryController.view();
}

function libraryDatasetsView() {
  return libraryController.datasetsView();
}

function renderLibraryDatasets() {
  libraryController.renderDatasets();
}

function renderLibraryPreview() {
  libraryController.renderPreview();
}

function renderLibraryEditor() {
  libraryController.renderEditor();
}

function renderLibraryLive() {
  libraryController.renderLive();
}

function syncLibrarySelectedDataset() {
  libraryController.syncSelectedDataset();
}

function syncLibraryDatasetsPanel() {
  libraryController.syncDatasetsPanel();
}

function noteEditorView() {
  return libraryController.noteEditorView();
}

function importPreviewView() {
  return libraryController.importPreviewView();
}

function learnView() {
  return learnController.view();
}

function learnFilterCard(entries) {
  return learnController.filterCard(entries);
}

function learnFilterSummary(entries) {
  return learnController.filterSummary(entries);
}

function learnResultsView(entries) {
  return learnController.resultsView(entries);
}

function filterDrawerView(scope) {
  const isQuiz = scope === "quiz";
  const isOpen = isQuiz ? state.quizFiltersOpen : state.learnFiltersOpen;
  const title = isQuiz ? "Quiz filters" : "Learn filters";
  const description = isQuiz ? "File, direction, and card types." : "File, order, search, and visible types.";
  return `
    <div class="filter-drawer ${isOpen ? "open" : ""}" data-filter-drawer="${scope}" aria-hidden="${isOpen ? "false" : "true"}">
      <button class="filter-drawer-backdrop" data-action="close-${scope}-filters" aria-label="Close ${scope} filters"></button>
      <aside class="panel filter-drawer-panel">
        <div class="section-heading">
          <div>
            <h2>${title}</h2>
            <p>${description}</p>
          </div>
          <button data-action="close-${scope}-filters">Close</button>
        </div>
        ${filtersView(scope)}
        ${isQuiz ? `<div class="toolbar"><button data-action="toggle-shortcuts">?</button></div>` : ""}
      </aside>
    </div>
  `;
}

function filtersView(scope) {
  const config = scope === "learn" ? state.learn : state.quizConfig;
  const source = sourceLabel();
  const target = targetLabel();
  return `
    <div class="filter-panel">
      <div class="filter-group datasets-filter">
        <div class="filter-label">Datasets</div>
        <div class="dataset-picker">
          ${state.datasets.length ? allDatasetsChoice(scope, config) + state.datasets.map((dataset) => datasetChoice(scope, config, dataset)).join("") : `<p class="muted">No datasets yet.</p>`}
        </div>
      </div>
      <div class="filter-row">
        ${scope === "learn" ? `<div class="field"><label>Order</label><select data-${scope}-field="order"><option value="original">Original</option><option value="shuffle" ${config.order === "shuffle" ? "selected" : ""}>Shuffle</option></select></div>` : ""}
        <div class="field"><label>Direction</label><select data-${scope}-field="direction">
          <option value="spanish-to-english" ${config.direction === "spanish-to-english" ? "selected" : ""}>${source} to ${target}</option>
          <option value="english-to-spanish" ${config.direction === "english-to-spanish" ? "selected" : ""}>${target} to ${source}</option>
          ${scope === "quiz" ? `<option value="mixed" ${config.direction === "mixed" ? "selected" : ""}>Mixed</option>` : ""}
        </select></div>
        ${scope === "learn" ? `<div class="field search-field"><label>Search</label><input data-${scope}-field="searchQuery" value="${escapeAttr(config.searchQuery ?? "")}"></div>` : ""}
      </div>
      <div class="filter-group">
        <div class="filter-label">Types</div>
        <div class="checkbox-row compact">
          ${TYPE_OPTIONS.map((type) => `<label><input type="checkbox" data-${scope}-type="${type.value}" ${config.typeFilters.includes(type.value) ? "checked" : ""}>${type.label}</label>`).join("")}
          <label class="mastered-toggle"><input type="checkbox" data-${scope}-field="includeMastered" ${config.includeMastered ? "checked" : ""}>Include mastered</label>
        </div>
      </div>
    </div>
  `;
}

function allDatasetsChoice(scope, config) {
  const selectedCount = config.datasetIds === "all" ? state.datasets.length : config.datasetIds.length;
  const checked = selectedCount === state.datasets.length && state.datasets.length > 0;
  return `
    <label class="dataset-choice all-choice ${checked ? "selected" : ""}">
      <input type="checkbox" data-${scope}-all-datasets ${checked ? "checked" : ""}>
      <span>
        <strong>All datasets</strong>
        <small data-${scope}-dataset-count>${selectedCount} of ${state.datasets.length} selected</small>
      </span>
    </label>
  `;
}

function datasetChoice(scope, config, dataset) {
  const count = state.entries.filter((entry) => entry.datasetId === dataset.id).length;
  return `
    <label class="dataset-choice ${datasetSelected(config, dataset.id) ? "selected" : ""}">
      <input type="checkbox" data-${scope}-dataset-choice="${dataset.id}" ${datasetSelected(config, dataset.id) ? "checked" : ""}>
      <span>
        <strong>${escapeHtml(dataset.title)}</strong>
        <small>${count} words</small>
      </span>
    </label>
  `;
}

function entriesTable(entries, blurEnabled) {
  return learnController.entriesTable(entries, blurEnabled);
}

function tableCell(entry, column, blurEnabled) {
  return learnController.tableCell(entry, column, blurEnabled);
}

function renderLearnLive() {
  learnController.renderLive();
}

function syncLearnFilterControls() {
  syncDatasetControls("learn", state.learn);
}

function syncDatasetControls(scope, config) {
  const selectedIds = config.datasetIds === "all" ? state.datasets.map((dataset) => dataset.id) : config.datasetIds;
  const selected = new Set(selectedIds);
  const allInput = app.querySelector(`[data-${scope}-all-datasets]`);
  const count = app.querySelector(`[data-${scope}-dataset-count]`);
  const allChecked = state.datasets.length > 0 && selectedIds.length === state.datasets.length;
  if (allInput) allInput.checked = allChecked;
  if (count) count.textContent = `${selectedIds.length} of ${state.datasets.length} selected`;
  app.querySelectorAll(`[data-${scope}-dataset-choice]`).forEach((input) => {
    input.checked = selected.has(input.dataset[`${scope}DatasetChoice`]);
    input.closest(".dataset-choice")?.classList.toggle("selected", input.checked);
  });
  allInput?.closest(".dataset-choice")?.classList.toggle("selected", allChecked);
}

function syncFilterDrawer(scope) {
  const isOpen = scope === "quiz" ? state.quizFiltersOpen : state.learnFiltersOpen;
  const drawer = app.querySelector(`[data-filter-drawer="${scope}"]`);
  if (!drawer) return;
  drawer.classList.toggle("open", isOpen);
  drawer.setAttribute("aria-hidden", isOpen ? "false" : "true");
}

function syncBlurredColumns() {
  learnController.syncBlurredColumns();
}

function syncBlurredColumn(column) {
  learnController.syncBlurredColumn(column);
}

function quizView() {
  return quizController.view();
}

function renderQuizFocus() {
  quizController.renderFocus();
}

function renderQuizLive() {
  quizController.renderLive();
}

function renderQuizPanelsLive() {
  quizController.renderPanelsLive();
}

function syncQuizFileCard(current) {
  quizController.syncFileCard(current);
}

function settingsView() {
  return `
    <section class="panel">
      <div class="grid">
        <div class="field"><label>Theme</label><select data-setting="theme"><option value="system" ${state.settings.theme === "system" ? "selected" : ""}>System</option><option value="light" ${state.settings.theme === "light" ? "selected" : ""}>Light</option><option value="dark" ${state.settings.theme === "dark" ? "selected" : ""}>Dark</option></select></div>
        <div class="field"><label>Font family</label><input data-setting="fontFamily" value="${escapeAttr(state.settings.fontFamily)}"></div>
        <div class="field"><label>Font size</label><select data-setting="fontSize"><option value="small" ${state.settings.fontSize === "small" ? "selected" : ""}>Small</option><option value="medium" ${state.settings.fontSize === "medium" ? "selected" : ""}>Medium</option><option value="large" ${state.settings.fontSize === "large" ? "selected" : ""}>Large</option></select></div>
        <div class="field"><label>Background</label><select data-setting="background">
          <option value="plain" ${state.settings.background === "plain" ? "selected" : ""}>Plain</option>
          <option value="grid" ${state.settings.background === "grid" ? "selected" : ""}>Soft grid</option>
          <option value="paper" ${state.settings.background === "paper" ? "selected" : ""}>Paper</option>
          <option value="aurora" ${state.settings.background === "aurora" ? "selected" : ""}>Aurora</option>
          <option value="night" ${state.settings.background === "night" ? "selected" : ""}>Night study</option>
        </select></div>
      </div>
      <div class="checkbox-row"><label><input type="checkbox" data-setting="keyboardShortcutsEnabled" ${state.settings.keyboardShortcutsEnabled ? "checked" : ""}>Keyboard shortcuts enabled</label></div>
      <div class="toolbar"><button class="primary" data-action="save-settings">Save settings</button></div>
    </section>
  `;
}

async function onClick(event) {
  const target = event.target.closest("[data-route], [data-action], [data-select-dataset], [data-blur-column]");
  if (!target) return;
  const route = target.dataset.route;
  if (route) {
    state.route = route;
    state.quizFiltersOpen = false;
    state.learnFiltersOpen = false;
    render();
    return;
  }
  if (target.dataset.selectDataset) {
    state.selectedDatasetId = target.dataset.selectDataset;
    if (state.route === "notes") {
      libraryController.selectDataset(target.dataset.selectDataset);
      return;
    }
    await refreshAll();
    render();
    return;
  }
  if (target.dataset.blurColumn) {
    toggleSet(state.blurredColumns, target.dataset.blurColumn);
    syncBlurredColumn(target.dataset.blurColumn);
    return;
  }
  await handleAction(target.dataset.action, target);
}

async function onDoubleClick(event) {
  const target = event.target.closest("[data-select-dataset]");
  if (!target) return;
  openDatasetInLearn(target.dataset.selectDataset);
}

async function handleLibraryAction(action, target) {
  return libraryController.handleAction(action, target);
}

async function handleAction(action, target) {
  const quizLiveActions = new Set([
    "reveal",
    "quiz-plus",
    "quiz-minus",
    "verb-translation-plus",
    "verb-translation-minus",
    "verb-details-plus",
    "verb-details-minus",
  ]);
  if (action === "toggle-learn-filters" || action === "close-learn-filters") {
    state.learnFiltersOpen = action === "toggle-learn-filters" ? !state.learnFiltersOpen : false;
    syncFilterDrawer("learn");
    return;
  }
  if (action === "switch-language-pair") {
    await switchLanguagePair(target.dataset.pairId);
    return;
  }
  if (action === "toggle-quiz-filters" || action === "close-quiz-filters") {
    state.quizFiltersOpen = action === "toggle-quiz-filters" ? !state.quizFiltersOpen : false;
    syncFilterDrawer("quiz");
    return;
  }
  if (state.route === "notes" && await handleLibraryAction(action, target)) return;
  let handled = true;
  if (action === "clear-preview") state.preview = null;
  else if (action === "skip-preview-invalid" && state.preview) state.preview.invalidLines = [];
  else if (action === "reparse-invalid") await reparseInvalid(target.dataset.invalidId);
  else if (action === "skip-invalid") await skipInvalid(target.dataset.invalidId);
  else if (action === "keep-conflict") keepConflict(target.dataset.conflictId);
  else if (action === "discard-conflict") discardConflict(target.dataset.conflictId);
  else if (action === "keep-all-conflicts") keepAllConflicts();
  else if (action === "discard-all-conflicts") discardAllConflicts();
  else if (action === "keep-all-warning-conflicts") keepAllWarningConflicts();
  else if (action === "discard-all-warning-conflicts") discardAllWarningConflicts();
  else if (action === "confirm-import") await confirmImport();
  else if (action === "add-manual-row") state.manualRows.push(emptyManualRow());
  else if (action === "remove-manual-row") state.manualRows.splice(Number(target.dataset.rowIndex), 1);
  else if (action === "add-existing-row") state.editRows.push(emptyEditRow(state.editDatasetId));
  else if (action === "remove-existing-row") removeExistingRow(Number(target.dataset.rowIndex));
  else if (action === "save-manual") await saveManual();
  else if (action === "save-existing") await saveExisting();
  else if (action === "delete-dataset") await deleteDataset(target.dataset.datasetId);
  else if (action === "start-quiz") await startQuiz();
  else if (action === "finish-quiz") await finishQuiz();
  else if (action === "reveal") await revealCurrent();
  else if (action === "verb-translation-plus" || action === "verb-translation-minus") await markVerbTranslation(action.endsWith("plus") ? "+" : "-");
  else if (action === "verb-details-plus" || action === "verb-details-minus") await markVerbDetails(action.endsWith("plus") ? "+" : "-");
  else if (action === "quiz-plus" || action === "quiz-minus") await scoreCurrent(action.endsWith("plus") ? "+" : "-");
  else if (action === "toggle-shortcuts") state.shortcutHelp = !state.shortcutHelp;
  else if (action === "save-settings") await saveSettings();
  else handled = false;
  if (!handled) return;
  if (quizLiveActions.has(action)) {
    renderQuizLive();
    return;
  }
  await refreshAll();
  render();
}

async function onChange(event) {
  const target = event.target;
  if (target.matches("[data-file-import]") && target.files[0]) {
    await loadFilePreview(target.files[0]);
    if (state.route === "notes") {
      renderLibraryPreview();
      updateMessageView();
      return;
    }
    render();
    return;
  }
  if (state.route === "notes" && target.matches("[data-manual-field], [data-existing-field], [data-manual-title], [data-existing-title], [data-preview-title], [data-invalid-edit], [data-library-dataset-search], [data-pair-language]")) {
    if (target.matches("[data-manual-field]")) updateManualField(target);
    if (target.matches("[data-existing-field]")) updateExistingField(target);
    if (target.matches("[data-manual-title]")) state.manualTitle = target.value;
    if (target.matches("[data-existing-title]")) state.editTitle = target.value;
    if (target.matches("[data-preview-title]") && state.preview) state.preview.dataset.title = target.value;
    if (target.matches("[data-invalid-edit]")) {
      const line = [...(state.preview?.invalidLines ?? []), ...state.invalidLines].find((item) => item.id === target.dataset.invalidEdit);
      if (line) line.editedText = target.value;
    }
    if (target.matches("[data-library-dataset-search]")) {
      state.libraryDatasetSearch = target.value;
      renderLibraryDatasets();
    }
    if (target.matches("[data-pair-language]")) updatePairLanguageDraft(target);
    return;
  }
  updateControl(target);
  if (state.route === "learn" && target.matches("[data-learn-all-datasets], [data-learn-dataset-choice], [data-learn-field], [data-learn-type]")) {
    renderLearnLive();
    return;
  }
  if (state.route === "quiz" && target.matches("[data-quiz-all-datasets], [data-quiz-dataset-choice], [data-quiz-field], [data-quiz-type]")) {
    await updateQuizQueue();
    renderQuizPanelsLive();
    return;
  }
  if (target.matches("[data-setting]")) {
    updateSettingDraft(target);
    return;
  }
}

function onInput(event) {
  const target = event.target;
  if (target.matches("[data-preview-title]") && state.preview) state.preview.dataset.title = target.value;
  if (target.matches("[data-invalid-edit]")) {
    const line = [...(state.preview?.invalidLines ?? []), ...state.invalidLines].find((item) => item.id === target.dataset.invalidEdit);
    if (line) line.editedText = target.value;
  }
  if (target.matches("[data-manual-field]")) updateManualField(target);
  if (target.matches("[data-existing-field]")) updateExistingField(target);
  if (target.matches("[data-existing-title]")) state.editTitle = target.value;
  if (target.matches("[data-manual-title]")) state.manualTitle = target.value;
  if (target.matches("[data-library-dataset-search]")) {
    state.libraryDatasetSearch = target.value;
    renderLibraryDatasets();
  }
  if (target.matches("[data-pair-language]")) updatePairLanguageDraft(target);
  if (target.matches("[data-learn-field]")) {
    updateControl(target);
    renderLearnLive();
  }
  if (target.matches("[data-rename-dataset]")) debounceRename(target.dataset.renameDataset, target.value);
  if (target.matches("[data-setting]")) updateSettingDraft(target);
}

async function loadFilePreview(file) {
  await libraryDataController.loadFilePreview(file);
}

async function confirmImport() {
  await libraryDataController.confirmImport();
}

async function reparseInvalid(id) {
  await libraryDataController.reparseInvalid(id);
}

async function skipInvalid(id) {
  await libraryDataController.skipInvalid(id);
}

function keepConflict(id) {
  libraryDataController.keepConflict(id);
}

function discardConflict(id) {
  libraryDataController.discardConflict(id);
}

function keepAllConflicts() {
  libraryDataController.keepAllConflicts();
}

function discardAllConflicts() {
  libraryDataController.discardAllConflicts();
}

function keepAllWarningConflicts() {
  libraryDataController.keepAllWarningConflicts();
}

function discardAllWarningConflicts() {
  libraryDataController.discardAllWarningConflicts();
}

async function saveManual() {
  await libraryDataController.saveManual();
}

async function saveExisting() {
  await libraryDataController.saveExisting();
}

function loadExistingDataset(datasetId) {
  libraryDataController.loadExistingDataset(datasetId);
}

function removeExistingRow(index) {
  libraryDataController.removeExistingRow(index);
}

async function deleteDataset(datasetId) {
  return libraryDataController.deleteDataset(datasetId);
}

async function startQuiz() {
  await quizSessionController.start();
}

async function updateQuizQueue() {
  await quizSessionController.updateQueue();
}

async function finishQuiz() {
  await quizSessionController.finish();
}

async function revealCurrent() {
  await quizSessionController.revealCurrent();
}

async function markVerbTranslation(result) {
  await quizSessionController.markVerbTranslation(result);
}

async function markVerbDetails(result) {
  await quizSessionController.markVerbDetails(result);
}

async function scoreCurrent(result) {
  await quizSessionController.scoreCurrent(result);
}

function openDatasetInLearn(datasetId) {
  state.learn.datasetIds = [datasetId];
  state.route = "learn";
  state.message = "";
  render();
}

function currentItem() {
  return quizSessionController.currentItem();
}

async function saveSettings() {
  await settingsRepo.save(state.settings);
  applySettingsToDocument(state.settings);
  state.message = "Settings saved.";
}

function updateControl(target) {
  for (const scope of ["learn", "quiz"]) {
    const config = scope === "learn" ? state.learn : state.quizConfig;
    if (target.matches(`[data-${scope}-all-datasets]`)) {
      config.datasetIds = target.checked ? (scope === "learn" ? "all" : state.datasets.map((dataset) => dataset.id)) : [];
    }
    if (target.matches(`[data-${scope}-dataset-choice]`)) {
      const selected = new Set(config.datasetIds === "all" ? state.datasets.map((dataset) => dataset.id) : config.datasetIds);
      const datasetId = target.dataset[`${scope}DatasetChoice`];
      if (target.checked) selected.add(datasetId);
      else selected.delete(datasetId);
      const selectedIds = [...selected];
      config.datasetIds = scope === "learn" && selectedIds.length === state.datasets.length ? "all" : selectedIds;
    }
    if (target.matches(`[data-${scope}-field]`)) {
      const field = target.dataset[`${scope}Field`];
      config[field] = target.type === "checkbox" ? target.checked : target.value;
    }
    if (target.matches(`[data-${scope}-type]`)) {
      const value = Number(target.dataset[`${scope}Type`]);
      if (target.checked && !config.typeFilters.includes(value)) config.typeFilters.push(value);
      if (!target.checked) config.typeFilters = config.typeFilters.filter((item) => item !== value);
    }
  }
}

function updateManualField(target) {
  const [index, field] = target.dataset.manualField.split(":");
  const row = state.manualRows[Number(index)];
  if (!row) return;
  row[field] = field === "typeCode" ? Number(target.value) : target.value;
}

function updateExistingField(target) {
  const [index, field] = target.dataset.existingField.split(":");
  const row = state.editRows[Number(index)];
  if (!row) return;
  row[field] = field === "typeCode" ? Number(target.value) : target.value;
}

function updateSettingDraft(target) {
  const field = target.dataset.setting;
  state.settings[field] = target.type === "checkbox" ? target.checked : target.value;
  applySettingsToDocument(state.settings);
}

function updatePairLanguageDraft(target) {
  if (target.dataset.pairLanguage === "a") state.pairLanguageSearchA = target.value;
  if (target.dataset.pairLanguage === "b") state.pairLanguageSearchB = target.value;
}

let renameTimer;
function debounceRename(datasetId, title) {
  clearTimeout(renameTimer);
  renameTimer = setTimeout(async () => {
    const dataset = await datasetsRepo.get(datasetId);
    if (!dataset || !title.trim()) return;
    await datasetsRepo.update({ ...dataset, title: title.trim(), updatedAt: nowIso() });
    await refreshAll();
    render();
  }, 400);
}

function onKeydown(event) {
  if (state.route !== "quiz" || !state.settings.keyboardShortcutsEnabled) return;
  if (event.key.toLowerCase() === "f" && state.quizSession?.queue.length) {
    state.quizFocusMode = true;
    render();
    return;
  }
  if (event.key === "Escape" && state.quizFocusMode) {
    state.quizFocusMode = false;
    render();
    return;
  }
  if (event.key === "?") {
    state.shortcutHelp = !state.shortcutHelp;
    render();
  }
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    handleAction("reveal", {});
  }
  if (event.key === "ArrowRight") handleAction("quiz-plus", {});
  if (event.key === "ArrowLeft") handleAction("quiz-minus", {});
}

function getLearnEntries() {
  return learnController.getEntries();
}

function dedupeByEntryKey(entries) {
  return learnController.dedupeByEntryKey(entries);
}

function datasetSelected(config, datasetId) {
  return config.datasetIds === "all" || config.datasetIds.includes(datasetId);
}

function entryLabel(entry) {
  return `${TYPE_CODE_MAP[entry.typeCode]} / ${escapeHtml(entry.spanish)} / ${escapeHtml(entry.english)}`;
}

function labelForColumn(column) {
  return { spanish: sourceLabel(), english: targetLabel(), type: "Type", details: "Details", conjugation: "Conjugation", mastered: "Mastered" }[column];
}

function activePair() {
  return state.languagePairs.find((pair) => pair.id === state.activeLanguagePairId) ?? null;
}

function activePairLabel() {
  return pairLabel(activePair());
}

function sourceLabel() {
  return languageLabel(activePair()?.sourceLanguage ?? "es");
}

function targetLabel() {
  return languageLabel(activePair()?.targetLanguage ?? "en");
}

function languageOptions() {
  return LANGUAGE_REGISTRY.map((language) => `<option value="${escapeAttr(language.name)}">${escapeHtml(language.name)} (${language.code})</option>`).join("");
}

async function createLanguagePair() {
  const source = languageByName(state.pairLanguageSearchA);
  const target = languageByName(state.pairLanguageSearchB);
  if (!source || !target) {
    state.message = "Choose both languages from the list.";
    return false;
  }
  if (source.code === target.code) {
    state.message = "Choose two different languages.";
    return false;
  }
  const id = canonicalPairId(source.code, target.code);
  if (!state.languagePairs.some((pair) => pair.id === id)) {
    const time = nowIso();
    await languagePairsRepo.create({
      id,
      sourceLanguage: source.code,
      targetLanguage: target.code,
      title: `${source.name}-${target.name}`,
      createdAt: time,
      updatedAt: time,
    });
  }
  state.pairLanguageSearchA = "";
  state.pairLanguageSearchB = "";
  await switchLanguagePair(id, { skipRefresh: false });
  state.message = `${source.name}-${target.name} is active.`;
  return true;
}

async function switchLanguagePair(pairId, options = {}) {
  if (!pairId || state.activeLanguagePairId === pairId && !options.skipRefresh) return;
  state.activeLanguagePairId = pairId;
  state.settings.activeLanguagePairId = pairId;
  await settingsRepo.save(state.settings);
  state.selectedDatasetId = null;
  state.editDatasetId = null;
  state.editTitle = "";
  state.editRows = [];
  state.deletedEntryIds = [];
  state.preview = null;
  state.learn.datasetIds = "all";
  state.quizConfig.datasetIds = [];
  state.quizSession = null;
  await context.quizRepo.clearActive();
  await refreshAll();
  render();
}

function formatConjugation(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const byTense = new Map();
  raw.split(";").forEach((part) => {
    const match = part.trim().match(/^(present|future|preterite)\s*:\s*(.+)$/i);
    if (match) byTense.set(match[1].toLowerCase(), match[2].trim());
  });
  if (!byTense.size) return escapeHtml(raw);
  const lines = ["present", "future", "preterite"]
    .filter((tense) => byTense.has(tense))
    .map((tense) => `<div class="conjugation-line"><span>${tense}:</span><strong>${escapeHtml(byTense.get(tense))}</strong></div>`);
  return `<div class="conjugation-lines">${lines.join("")}</div>`;
}

function toggleSet(set, value) {
  if (set.has(value)) set.delete(value);
  else set.add(value);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}
