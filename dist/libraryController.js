// @ts-nocheck
import { TYPE_OPTIONS } from "./core.js";
import { emptyEditRow, emptyManualRow } from "./appContext.js";
export class LibraryController {
    constructor(context, callbacks) {
        this.context = context;
        this.app = context.app;
        this.state = context.state;
        this.callbacks = callbacks;
    }
    view() {
        return `
      <div class="split">
        ${this.datasetsPanelView()}
        <section class="panel notes-workbench">
          <div data-library-preview>${this.state.preview ? this.importPreviewView() : ""}</div>
          <div data-library-editor>${this.noteEditorView()}</div>
        </section>
      </div>
    `;
    }
    datasetsPanelView() {
        return `
      <section class="panel library-datasets-panel open">
        <div class="section-heading">
          <div>
            <h2>Datasets</h2>
            <p>${this.callbacks.escapeHtml(this.callbacks.activePairLabel())}</p>
          </div>
        </div>
        <button class="dataset-row add-dataset-row ${this.state.noteEditorMode === "new" ? "active" : ""}" data-action="add-dataset">
          <span><strong>Add dataset</strong><span class="muted">Manual or file import</span></span>
        </button>
        <div class="library-search">
          <input data-library-dataset-search value="${this.callbacks.escapeAttr(this.state.libraryDatasetSearch)}" placeholder="Search datasets">
          <button data-action="clear-library-dataset-search" aria-label="Clear dataset search">Clear</button>
        </div>
        <div class="list" data-library-datasets>${this.datasetsView()}</div>
      </section>
    `;
    }
    datasetsView() {
        const query = this.state.libraryDatasetSearch.trim().toLowerCase();
        const datasets = query
            ? this.state.datasets.filter((dataset) => dataset.title.toLowerCase().includes(query))
            : this.state.datasets;
        if (!this.state.activeLanguagePairId)
            return `<p>Create a pair first.</p>`;
        if (!this.state.datasets.length)
            return `<p>No datasets saved for this pair yet.</p>`;
        if (!datasets.length)
            return `<p>No datasets match your search.</p>`;
        return datasets.map((dataset) => this.datasetRow(dataset)).join("");
    }
    noteEditorView() {
        if (!this.state.activeLanguagePairId)
            return this.newPairView();
        return `
      <div class="section-heading">
        <div>
          <h2>${this.state.noteEditorMode === "existing" ? "Dataset editor" : "New dataset"}</h2>
          <p>${this.callbacks.escapeHtml(this.callbacks.activePairLabel())}</p>
        </div>
      </div>
      ${this.state.noteEditorMode === "existing" ? this.existingEditorView() : this.newEditorView()}
      ${this.newPairView()}
    `;
    }
    newPairView() {
        return `
      <section class="pair-creator">
        <div class="section-heading">
          <div>
            <h2>New Pair</h2>
            <p>Create a language workspace from the built-in language list.</p>
          </div>
        </div>
        <datalist id="language-options">${this.callbacks.languageOptions()}</datalist>
        <div class="filter-row">
          <div class="field"><label>Source language</label><input list="language-options" data-pair-language="a" value="${this.callbacks.escapeAttr(this.state.pairLanguageSearchA)}" placeholder="Search language"></div>
          <div class="field"><label>Target language</label><input list="language-options" data-pair-language="b" value="${this.callbacks.escapeAttr(this.state.pairLanguageSearchB)}" placeholder="Search language"></div>
          <div class="field dataset-delete-field"><label>Create</label><button class="primary" data-action="create-language-pair">Create pair</button></div>
        </div>
      </section>
    `;
    }
    newEditorView() {
        return `
      <div class="field wide"><label>Title</label><input data-manual-title value="${this.callbacks.escapeAttr(this.state.manualTitle)}"></div>
      <div class="manual-list">${this.state.manualRows.map((row, index) => this.manualRowView(row, index, "manual")).join("")}</div>
      <div class="toolbar">
        <button data-action="add-manual-row">Add row</button>
        <button class="primary" data-action="save-manual">Save manual dataset</button>
      </div>
      <div class="import-collapse">
        <button class="library-datasets-toggle" data-action="toggle-library-import" aria-expanded="${this.state.libraryImportOpen ? "true" : "false"}">
          <span>Import from file</span>
          <span>${this.state.libraryImportOpen ? "Hide" : "Show"}</span>
        </button>
        <div data-library-import-body ${this.state.libraryImportOpen ? "" : "hidden"}>
          <div class="import-zone">
            <div>
              <strong>Choose a vocabulary file</strong>
              <span class="muted">First line must be: ? / source-code / target-code.</span>
            </div>
            <input type="file" data-file-import accept=".txt,.csv,.tsv,.json,.pdf,text/plain,application/json,application/pdf">
          </div>
        </div>
      </div>
    `;
    }
    existingEditorView() {
        const selected = this.state.datasets.find((dataset) => dataset.id === this.state.editDatasetId);
        return `
      <div class="field wide"><label>Title</label><input data-existing-title value="${this.callbacks.escapeAttr(this.state.editTitle || selected?.title || "")}" ${selected ? "" : "disabled"}></div>
      ${selected ? `
        <div class="manual-list">${this.state.editRows.map((row, index) => this.manualRowView(row, index, "existing")).join("")}</div>
        <div class="toolbar">
          <button data-action="add-existing-row">Add row</button>
          <button class="primary" data-action="save-existing">Save changes</button>
          <button class="danger" data-action="delete-dataset" data-dataset-id="${selected.id}">Delete dataset</button>
        </div>
      ` : `<p class="notice">Choose a dataset to edit its words.</p>`}
    `;
    }
    datasetRow(dataset) {
        const count = this.state.entries.filter((entry) => entry.datasetId === dataset.id).length;
        return `
      <div class="dataset-row ${this.state.selectedDatasetId === dataset.id ? "active" : ""}" data-select-dataset="${dataset.id}">
        <span><strong>${this.callbacks.escapeHtml(dataset.title)}</strong><span class="muted">${count} words · ${dataset.status}</span></span>
        <div class="dataset-row-actions">
          <button data-action="learn-dataset" data-dataset-id="${dataset.id}">Learn</button>
          <button class="danger" data-action="delete-dataset" data-dataset-id="${dataset.id}">Delete</button>
        </div>
      </div>
    `;
    }
    importPreviewView() {
        const blocking = this.previewHasBlockingErrors();
        return `
      <div class="panel">
        <h2>Import Preview</h2>
        <div class="toolbar">
          <div class="field"><label>Title</label><input data-preview-title value="${this.callbacks.escapeAttr(this.state.preview.dataset.title)}"></div>
          <span class="status ok">${this.state.preview.entries.length} words found</span>
          <span class="status ${this.state.preview.invalidLines.length ? "error" : "ok"}">${this.state.preview.invalidLines.length} invalid</span>
          <span class="status ${this.state.preview.duplicateConflicts.some((c) => c.severity === "error") ? "error" : this.state.preview.duplicateConflicts.length ? "warn" : "ok"}">${this.state.preview.duplicateConflicts.length} conflicts</span>
        </div>
        ${this.state.preview.invalidLines.length ? this.invalidPreviewList(this.state.preview.invalidLines) : ""}
        ${this.state.preview.duplicateConflicts.length ? this.conflictPreviewList(this.state.preview.duplicateConflicts) : ""}
        <div class="toolbar">
          <button class="primary" data-action="confirm-import" ${blocking ? "disabled" : ""}>Confirm save</button>
          <button data-action="skip-preview-invalid">Skip invalid lines</button>
          <button data-action="clear-preview">Cancel</button>
        </div>
      </div>
    `;
    }
    invalidPreviewList(lines) {
        return `
      <h3>Invalid Lines</h3>
      <div class="list">
        ${lines.map((line) => `
          <div class="card">
            <p><strong>Line ${line.lineNumber}:</strong> ${this.callbacks.escapeHtml(line.error)}</p>
            <textarea data-invalid-edit="${line.id}">${this.callbacks.escapeHtml(line.editedText ?? line.originalText)}</textarea>
            <div class="toolbar"><button data-action="reparse-invalid" data-invalid-id="${line.id}">Re-parse</button><button data-action="skip-invalid" data-invalid-id="${line.id}">Skip</button></div>
          </div>
        `).join("")}
      </div>
    `;
    }
    conflictPreviewList(conflicts) {
        const hasWarnings = conflicts.some((conflict) => conflict.severity === "warning");
        return `
      <h3>Duplicate Conflicts</h3>
      <div class="list">
        ${conflicts.map((conflict) => `
          <div class="card">
            <p><span class="status ${conflict.severity === "error" ? "error" : "warn"}">${conflict.severity}</span> ${this.callbacks.escapeHtml(conflict.reason)}</p>
            <p><strong>Incoming:</strong> ${this.callbacks.entryLabel(conflict.incomingEntry)}</p>
            ${conflict.existingEntry ? `<p><strong>Existing:</strong> ${this.callbacks.entryLabel(conflict.existingEntry)}</p>` : ""}
            ${conflict.sameDatasetEntry ? `<p><strong>Other row:</strong> ${this.callbacks.entryLabel(conflict.sameDatasetEntry)}</p>` : ""}
            <div class="toolbar">
              <button class="primary" data-action="keep-conflict" data-conflict-id="${conflict.id}">Keep</button>
              <button data-action="discard-conflict" data-conflict-id="${conflict.id}">Discard</button>
            </div>
          </div>
        `).join("")}
        ${hasWarnings ? `
          <div class="toolbar">
            <button class="primary" data-action="keep-all-warning-conflicts">Keep all warnings</button>
            <button data-action="discard-all-warning-conflicts">Discard all warnings</button>
          </div>
        ` : ""}
        <div class="toolbar conflict-bulk-actions">
          <button class="primary" data-action="keep-all-conflicts">Keep all</button>
          <button data-action="discard-all-conflicts">Discard all</button>
        </div>
      </div>
    `;
    }
    manualRowView(row, index, scope) {
        return `
      <div class="manual-row entry-editor-row">
        <select data-${scope}-field="${index}:typeCode">${TYPE_OPTIONS.map((type) => `<option value="${type.value}" ${Number(row.typeCode) === type.value ? "selected" : ""}>${type.label}</option>`).join("")}</select>
        <input placeholder="${this.callbacks.escapeAttr(this.callbacks.sourceLabel())}" data-${scope}-field="${index}:spanish" value="${this.callbacks.escapeAttr(row.spanish)}">
        <input placeholder="${this.callbacks.escapeAttr(this.callbacks.targetLabel())}" data-${scope}-field="${index}:english" value="${this.callbacks.escapeAttr(row.english)}">
        <input placeholder="Details" data-${scope}-field="${index}:details" value="${this.callbacks.escapeAttr(row.details)}">
        <input placeholder="Conjugation" data-${scope}-field="${index}:conjugation" value="${this.callbacks.escapeAttr(row.conjugation)}">
        <button data-action="${scope === "existing" ? "remove-existing-row" : "remove-manual-row"}" data-row-index="${index}">Remove</button>
      </div>
    `;
    }
    previewHasBlockingErrors() {
        return Boolean(this.state.preview?.invalidLines.length || this.state.preview?.duplicateConflicts.length);
    }
    renderDatasets() {
        const list = this.app.querySelector("[data-library-datasets]");
        if (list)
            list.innerHTML = this.datasetsView();
    }
    renderPreview() {
        const preview = this.app.querySelector("[data-library-preview]");
        if (preview)
            preview.innerHTML = this.state.preview ? this.importPreviewView() : "";
    }
    renderEditor() {
        const editor = this.app.querySelector("[data-library-editor]");
        if (editor)
            editor.innerHTML = this.noteEditorView();
    }
    renderLive() {
        this.callbacks.updateMessageView();
        this.renderDatasets();
        this.renderPreview();
        this.renderEditor();
    }
    syncSelectedDataset() {
        this.app.querySelectorAll("[data-select-dataset]").forEach((button) => {
            button.classList.toggle("active", button.dataset.selectDataset === this.state.selectedDatasetId);
        });
    }
    selectDataset(datasetId) {
        this.state.selectedDatasetId = datasetId;
        this.state.noteEditorMode = "existing";
        this.callbacks.loadExistingDataset(datasetId);
        this.syncSelectedDataset();
        this.renderEditor();
    }
    syncDatasetsPanel() {
        const panel = this.app.querySelector(".library-datasets-panel");
        const body = this.app.querySelector("[data-library-datasets-body]");
        const toggle = this.app.querySelector(".library-datasets-toggle");
        panel?.classList.toggle("open", this.state.libraryDatasetsOpen);
        if (body)
            body.hidden = !this.state.libraryDatasetsOpen;
        if (toggle) {
            toggle.setAttribute("aria-expanded", this.state.libraryDatasetsOpen ? "true" : "false");
            const status = toggle.querySelector("span:last-child");
            if (status)
                status.textContent = this.state.libraryDatasetsOpen ? "Hide" : "Show";
        }
    }
    async handleAction(action, target) {
        if (action === "add-dataset") {
            this.state.noteEditorMode = "new";
            this.state.selectedDatasetId = null;
            this.state.editDatasetId = null;
            this.state.editRows = [];
            this.renderLive();
            return true;
        }
        if (action === "toggle-library-import") {
            this.state.libraryImportOpen = !this.state.libraryImportOpen;
            this.renderEditor();
            return true;
        }
        if (action === "create-language-pair") {
            await this.callbacks.createLanguagePair();
            await this.callbacks.refreshAll();
            this.renderLive();
            return true;
        }
        if (action === "toggle-library-datasets") {
            this.state.libraryDatasetsOpen = !this.state.libraryDatasetsOpen;
            this.syncDatasetsPanel();
            return true;
        }
        if (action === "clear-library-dataset-search") {
            this.state.libraryDatasetSearch = "";
            const input = this.app.querySelector("[data-library-dataset-search]");
            if (input)
                input.value = "";
            this.renderDatasets();
            return true;
        }
        if (action === "learn-dataset") {
            this.callbacks.openDatasetInLearn(target.dataset.datasetId);
            return true;
        }
        if (action === "delete-dataset") {
            const datasetId = target.dataset.datasetId;
            const deleted = await this.callbacks.deleteDataset(datasetId);
            if (!deleted)
                return true;
            await this.callbacks.refreshAll();
            if (this.state.editDatasetId === datasetId) {
                this.state.editDatasetId = null;
                this.state.editTitle = "";
                this.state.editRows = [];
                this.state.deletedEntryIds = [];
            }
            else if (this.state.editDatasetId && this.state.datasets.some((dataset) => dataset.id === this.state.editDatasetId)) {
                this.callbacks.loadExistingDataset(this.state.editDatasetId);
            }
            this.renderLive();
            return true;
        }
        if (action === "clear-preview") {
            this.state.preview = null;
            this.renderPreview();
            this.callbacks.updateMessageView();
            return true;
        }
        if (action === "skip-preview-invalid" && this.state.preview) {
            this.state.preview.invalidLines = [];
            this.renderPreview();
            return true;
        }
        if (action === "reparse-invalid") {
            await this.callbacks.reparseInvalid(target.dataset.invalidId);
            if (!this.state.preview)
                await this.callbacks.refreshAll();
            this.renderLive();
            return true;
        }
        if (action === "skip-invalid") {
            await this.callbacks.skipInvalid(target.dataset.invalidId);
            if (!this.state.preview)
                await this.callbacks.refreshAll();
            this.renderLive();
            return true;
        }
        if (action === "keep-conflict") {
            this.callbacks.keepConflict(target.dataset.conflictId);
            this.renderPreview();
            return true;
        }
        if (action === "discard-conflict") {
            this.callbacks.discardConflict(target.dataset.conflictId);
            this.renderPreview();
            return true;
        }
        if (action === "keep-all-conflicts") {
            this.callbacks.keepAllConflicts();
            this.renderPreview();
            return true;
        }
        if (action === "discard-all-conflicts") {
            this.callbacks.discardAllConflicts();
            this.renderPreview();
            return true;
        }
        if (action === "keep-all-warning-conflicts") {
            this.callbacks.keepAllWarningConflicts();
            this.renderPreview();
            return true;
        }
        if (action === "discard-all-warning-conflicts") {
            this.callbacks.discardAllWarningConflicts();
            this.renderPreview();
            return true;
        }
        if (action === "add-manual-row") {
            this.state.manualRows.push(emptyManualRow());
            this.renderEditor();
            return true;
        }
        if (action === "remove-manual-row") {
            this.state.manualRows.splice(Number(target.dataset.rowIndex), 1);
            this.renderEditor();
            return true;
        }
        if (action === "add-existing-row") {
            this.state.editRows.push(emptyEditRow(this.state.editDatasetId));
            this.renderEditor();
            return true;
        }
        if (action === "remove-existing-row") {
            this.callbacks.removeExistingRow(Number(target.dataset.rowIndex));
            this.renderEditor();
            return true;
        }
        if (action === "confirm-import") {
            await this.callbacks.confirmImport();
            await this.callbacks.refreshAll();
            if (this.state.editDatasetId)
                this.callbacks.loadExistingDataset(this.state.editDatasetId);
            this.renderLive();
            return true;
        }
        if (action === "save-manual") {
            await this.callbacks.saveManual();
            await this.callbacks.refreshAll();
            this.renderLive();
            return true;
        }
        if (action === "save-existing") {
            const editedId = this.state.editDatasetId;
            await this.callbacks.saveExisting();
            await this.callbacks.refreshAll();
            if (editedId && this.state.datasets.some((dataset) => dataset.id === editedId))
                this.callbacks.loadExistingDataset(editedId);
            this.renderLive();
            return true;
        }
        return false;
    }
}
