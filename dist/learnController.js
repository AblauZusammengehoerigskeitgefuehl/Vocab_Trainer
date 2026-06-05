// @ts-nocheck
import { TYPE_CODE_MAP, conjugationText, entryKey, filterEntries, } from "./core.js";
export class LearnController {
    constructor(context, callbacks) {
        this.context = context;
        this.app = context.app;
        this.state = context.state;
        this.callbacks = callbacks;
    }
    view() {
        const entries = this.getEntries();
        return `
      <div class="filter-status-row">
        ${this.filterCard(entries)}
        <button data-action="toggle-learn-filters">Filters</button>
      </div>
      <section class="panel" data-learn-results>
        ${this.resultsView(entries)}
      </section>
      ${this.callbacks.filterDrawerView("learn")}
    `;
    }
    filterCard(entries) {
        const summary = this.filterSummary(entries);
        return `
      <div class="filter-summary-card" data-learn-filter-card>
        <span>Learn filter</span>
        <strong data-learn-filter-label>${this.callbacks.escapeHtml(summary.label)}</strong>
        <small data-learn-filter-count>${summary.count}</small>
      </div>
    `;
    }
    filterSummary(entries) {
        const datasetIds = this.state.learn.datasetIds === "all" ? this.state.datasets.map((dataset) => dataset.id) : this.state.learn.datasetIds;
        const label = this.state.learn.datasetIds === "all"
            ? "All datasets"
            : datasetIds.map((id) => this.state.datasets.find((dataset) => dataset.id === id)?.title).filter(Boolean).join(", ") || "No dataset selected";
        return { label, count: `${entries.length} visible words` };
    }
    resultsView(entries) {
        return `
      ${this.state.datasets.length ? "" : `<p class="notice">Import at least one dataset before Learn starts.</p>`}
      ${entries.length ? this.entriesTable(entries, true) : `<p>No matching entries for the current filters.</p>`}
    `;
    }
    entriesTable(entries, blurEnabled) {
        const first = this.state.learn.direction === "english-to-spanish" ? "english" : "spanish";
        const second = first === "english" ? "spanish" : "english";
        const columns = [first, second, "type", "conjugation", "details", "mastered"];
        return `
      <div class="table-wrap">
        <table class="${blurEnabled ? "learn-table" : ""}">
          <thead><tr>${columns.map((column) => `<th ${blurEnabled ? `data-blur-column="${column}"` : ""} class="${this.state.blurredColumns.has(column) ? "active" : ""}">${this.callbacks.labelForColumn(column)}</th>`).join("")}</tr></thead>
          <tbody>
            ${entries.map((entry) => `<tr>${columns.map((column) => this.tableCell(entry, column, blurEnabled)).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </div>
    `;
    }
    tableCell(entry, column, blurEnabled) {
        const value = column === "type" ? TYPE_CODE_MAP[entry.typeCode]
            : column === "mastered" ? (entry.masteryCount >= 5 ? `Yes (${entry.masteryCount})` : `No (${entry.masteryCount})`)
                : column === "conjugation" ? conjugationText(entry)
                    : entry[column] ?? "";
        const blurred = blurEnabled && this.state.blurredColumns.has(column) ? "blurred" : "";
        const html = column === "conjugation" ? this.callbacks.formatConjugation(value) : this.callbacks.escapeHtml(value);
        return `<td data-label="${this.callbacks.labelForColumn(column)}" class="${blurred} ${column === "conjugation" ? "conjugation-cell" : ""}">${html}</td>`;
    }
    renderLive() {
        const entries = this.getEntries();
        const summary = this.filterSummary(entries);
        const label = this.app.querySelector("[data-learn-filter-label]");
        const count = this.app.querySelector("[data-learn-filter-count]");
        const results = this.app.querySelector("[data-learn-results]");
        if (label)
            label.textContent = summary.label;
        if (count)
            count.textContent = summary.count;
        if (results)
            results.innerHTML = this.resultsView(entries);
        this.callbacks.syncDatasetControls("learn", this.state.learn);
        this.syncBlurredColumns();
    }
    syncBlurredColumns() {
        ["spanish", "english", "type", "conjugation", "details", "mastered"].forEach((column) => this.syncBlurredColumn(column));
    }
    syncBlurredColumn(column) {
        const isBlurred = this.state.blurredColumns.has(column);
        const label = this.callbacks.labelForColumn(column);
        this.app.querySelectorAll(`[data-blur-column="${column}"]`).forEach((header) => {
            header.classList.toggle("active", isBlurred);
        });
        this.app.querySelectorAll(`[data-label="${label}"]`).forEach((cell) => {
            cell.classList.toggle("blurred", isBlurred);
        });
    }
    getEntries() {
        const datasetIds = this.state.learn.datasetIds === "all" ? this.state.datasets.map((dataset) => dataset.id) : this.state.learn.datasetIds;
        const entries = this.state.entries.filter((entry) => datasetIds.includes(entry.datasetId));
        return this.dedupeByEntryKey(filterEntries(entries, this.state.learn));
    }
    dedupeByEntryKey(entries) {
        const deduped = new Map();
        entries.forEach((entry) => {
            const key = entryKey(entry);
            if (!deduped.has(key))
                deduped.set(key, entry);
        });
        return [...deduped.values()];
    }
}
