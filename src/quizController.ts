// @ts-nocheck
import {
  answerFor,
  canShowVerbDetails,
  conjugationText,
  promptFor,
} from "./core.js";

export class QuizController {
  constructor(context, callbacks) {
    this.context = context;
    this.app = context.app;
    this.state = context.state;
    this.callbacks = callbacks;
  }

  view() {
    const entriesById = new Map(this.state.entries.map((entry) => [entry.id, entry]));
    const current = this.callbacks.currentItem();
    const entry = current ? entriesById.get(current.entryId) : null;
    return `
      ${this.statusRowView(current)}
      <div class="quiz-main" data-quiz-main>
        ${this.state.shortcutHelp ? this.shortcutHelpView() : ""}
        ${this.state.quizSession && entry && current ? this.cardView(current, entry) : this.emptyView()}
        ${this.state.quizSession ? this.trackerView(entriesById) : ""}
      </div>
      ${this.callbacks.filterDrawerView("quiz")}
    `;
  }

  statusRowView(current) {
    return `
      <div class="quiz-status-row">
        ${this.fileCard(current)}
        <div class="toolbar compact-toolbar" data-quiz-toolbar>
          ${this.state.quizSession ? "" : `<button class="primary" data-action="start-quiz">Start quiz</button>`}
          <button data-action="toggle-quiz-filters">Filters</button>
          ${this.state.quizSession ? `<button class="danger" data-action="finish-quiz">Finish Quiz</button>` : ""}
        </div>
      </div>
    `;
  }

  focusView() {
    const entriesById = new Map(this.state.entries.map((entry) => [entry.id, entry]));
    const item = this.callbacks.currentItem();
    const entry = item ? entriesById.get(item.entryId) : null;
    if (!this.state.quizSession || !item || !entry) {
      this.state.quizFocusMode = false;
      return "";
    }
    const revealedTranslation = item.revealLevel >= 1;
    const revealedDetails = item.revealLevel >= 2;
    return `
      <main class="quiz-focus-screen" data-action="reveal">
        <section class="quiz-focus-card">
          <div>
            <div class="quiz-focus-prompt" data-focus-prompt>${this.callbacks.escapeHtml(promptFor(item, entry))}</div>
            <div class="quiz-focus-answer" data-focus-answer ${revealedTranslation ? "" : "hidden"}>${revealedTranslation ? this.callbacks.escapeHtml(answerFor(item, entry)) : ""}</div>
            <div class="quiz-focus-details" data-focus-details ${revealedDetails ? "" : "hidden"}>${revealedDetails ? this.callbacks.formatConjugation(conjugationText(entry)) : ""}</div>
          </div>
        </section>
      </main>
    `;
  }

  renderFocus() {
    const data = this.focusData();
    if (!data) {
      this.state.quizFocusMode = false;
      this.callbacks.render();
      return;
    }
    if (this.app.dataset.mode !== "focus" || !this.app.querySelector("[data-focus-prompt]")) {
      this.app.dataset.mode = "focus";
      this.app.innerHTML = this.focusView();
      return;
    }
    const prompt = this.app.querySelector("[data-focus-prompt]");
    const answer = this.app.querySelector("[data-focus-answer]");
    const details = this.app.querySelector("[data-focus-details]");
    if (prompt) prompt.textContent = data.prompt;
    if (answer) {
      answer.hidden = !data.revealedTranslation;
      answer.textContent = data.revealedTranslation ? data.answer : "";
    }
    if (details) {
      details.hidden = !data.revealedDetails;
      details.innerHTML = data.revealedDetails ? data.details : "";
    }
  }

  focusData() {
    const entriesById = new Map(this.state.entries.map((entry) => [entry.id, entry]));
    const item = this.callbacks.currentItem();
    const entry = item ? entriesById.get(item.entryId) : null;
    if (!this.state.quizSession || !item || !entry) return null;
    return {
      prompt: promptFor(item, entry),
      answer: answerFor(item, entry),
      details: this.callbacks.formatConjugation(conjugationText(entry)),
      revealedTranslation: item.revealLevel >= 1,
      revealedDetails: item.revealLevel >= 2,
    };
  }

  renderLive() {
    if (this.state.quizFocusMode) {
      this.renderFocus();
      return;
    }
    if (this.state.route !== "quiz") {
      this.callbacks.render();
      return;
    }
    const entriesById = new Map(this.state.entries.map((entry) => [entry.id, entry]));
    const item = this.callbacks.currentItem();
    const entry = item ? entriesById.get(item.entryId) : null;
    if (!this.state.quizSession || !item || !entry) {
      this.callbacks.render();
      return;
    }
    const prompt = this.app.querySelector("[data-quiz-prompt]");
    const answer = this.app.querySelector("[data-quiz-answer]");
    const details = this.app.querySelector("[data-quiz-details]");
    const actions = this.app.querySelector("[data-quiz-actions]");
    const trackerSummary = this.app.querySelector("[data-quiz-tracker-summary]");
    const trackerList = this.app.querySelector("[data-quiz-tracker-list]");
    if (!prompt || !answer || !details || !actions || !trackerSummary || !trackerList) {
      this.callbacks.render();
      return;
    }
    const revealedTranslation = item.revealLevel >= 1;
    const revealedDetails = item.revealLevel >= 2;
    prompt.textContent = promptFor(item, entry);
    answer.hidden = !revealedTranslation;
    answer.textContent = revealedTranslation ? answerFor(item, entry) : "";
    details.hidden = !revealedDetails;
    details.innerHTML = revealedDetails ? this.callbacks.formatConjugation(conjugationText(entry)) : "";
    actions.innerHTML = this.actionsView(item, entry);
    const completed = Object.values(this.state.quizSession.sessionScores).filter((score) => score >= 5).length;
    trackerSummary.textContent = `${this.state.quizSession.queue.length} active · ${completed} completed · ${this.state.quizSession.direction}`;
    trackerList.innerHTML = this.trackerRows(entriesById);
    this.syncFileCard(item);
  }

  renderPanelsLive() {
    if (this.state.quizFocusMode) {
      this.renderFocus();
      return;
    }
    const entriesById = new Map(this.state.entries.map((entry) => [entry.id, entry]));
    const item = this.callbacks.currentItem();
    const entry = item ? entriesById.get(item.entryId) : null;
    const main = this.app.querySelector("[data-quiz-main]");
    this.syncFileCard(item);
    this.callbacks.syncDatasetControls("quiz", this.state.quizConfig);
    if (!this.state.quizSession || !item || !entry) {
      if (main) {
        main.innerHTML = `
          ${this.state.shortcutHelp ? this.shortcutHelpView() : ""}
          ${this.emptyView()}
        `;
      }
      return;
    }
    const prompt = this.app.querySelector("[data-quiz-prompt]");
    const answer = this.app.querySelector("[data-quiz-answer]");
    const details = this.app.querySelector("[data-quiz-details]");
    const actions = this.app.querySelector("[data-quiz-actions]");
    const trackerSummary = this.app.querySelector("[data-quiz-tracker-summary]");
    const trackerList = this.app.querySelector("[data-quiz-tracker-list]");
    if (!prompt || !answer || !details || !actions || !trackerSummary || !trackerList) {
      if (main) {
        main.innerHTML = `
          ${this.state.shortcutHelp ? this.shortcutHelpView() : ""}
          ${this.cardView(item, entry)}
          ${this.trackerView(entriesById)}
        `;
      }
      return;
    }
    prompt.textContent = promptFor(item, entry);
    answer.hidden = item.revealLevel < 1;
    answer.textContent = item.revealLevel >= 1 ? answerFor(item, entry) : "";
    details.hidden = item.revealLevel < 2;
    details.innerHTML = item.revealLevel >= 2 ? this.callbacks.formatConjugation(conjugationText(entry)) : "";
    actions.innerHTML = this.actionsView(item, entry);
    const completed = Object.values(this.state.quizSession.sessionScores).filter((score) => score >= 5).length;
    trackerSummary.textContent = `${this.state.quizSession.queue.length} active · ${completed} completed · ${this.state.quizSession.direction}`;
    trackerList.innerHTML = this.trackerRows(entriesById);
  }

  syncFileCard(current) {
    const fileCard = this.app.querySelector(".quiz-file-card");
    if (!fileCard) return;
    const data = this.fileCardData(current);
    const label = fileCard.querySelector("[data-quiz-file-label]");
    const count = fileCard.querySelector("[data-quiz-file-count]");
    if (label) label.textContent = data.label;
    if (count) count.textContent = data.countText;
  }

  fileCardData(current) {
    const datasetIds = current ? [current.datasetId] : this.state.quizConfig.datasetIds;
    const selected = datasetIds
      .map((id) => this.state.datasets.find((dataset) => dataset.id === id)?.title)
      .filter(Boolean);
    return {
      label: selected[0] ?? (this.state.datasets.length ? "No quiz file selected" : "No files imported"),
      countText: this.state.quizSession ? `${this.state.quizSession.queue.length} active cards` : `${selected.length} selected`,
    };
  }

  fileCard(current) {
    const data = this.fileCardData(current);
    return `
      <div class="quiz-file-card">
        <span>Current quiz file</span>
        <strong data-quiz-file-label>${this.callbacks.escapeHtml(data.label)}</strong>
        <small data-quiz-file-count>${this.callbacks.escapeHtml(data.countText)}</small>
      </div>
    `;
  }

  trackerRows(entriesById) {
    return this.state.quizSession.queue.map((item) => {
      const entry = entriesById.get(item.entryId);
      if (!entry) return "";
      const score = this.state.quizSession.sessionScores[item.entryKey] ?? 0;
      return `<div class="dataset-row"><span>${entry.masteryCount >= 5 ? "✓ " : ""}${this.callbacks.escapeHtml(entry.spanish)} <span class="muted">${this.callbacks.escapeHtml(entry.english)}</span></span><span>${score > 0 ? "+" : ""}${score} mastery: ${entry.masteryCount}</span></div>`;
    }).join("");
  }

  cardView(item, entry) {
    const revealedTranslation = item.revealLevel >= 1;
    const revealedDetails = item.revealLevel >= 2;
    return `
      <section class="panel flashcard" data-action="reveal" data-quiz-card>
        <div>
          <div class="prompt" data-quiz-prompt>${this.callbacks.escapeHtml(promptFor(item, entry))}</div>
          <div class="answer" data-quiz-answer ${revealedTranslation ? "" : "hidden"}>${revealedTranslation ? this.callbacks.escapeHtml(answerFor(item, entry)) : ""}</div>
          <div class="details-box" data-quiz-details ${revealedDetails ? "" : "hidden"}>${revealedDetails ? this.callbacks.formatConjugation(conjugationText(entry)) : ""}</div>
        </div>
      </section>
      <div class="actions" data-quiz-actions>
        ${this.actionsView(item, entry)}
      </div>
    `;
  }

  actionsView(item, entry) {
    const revealedTranslation = item.revealLevel >= 1;
    const revealedDetails = item.revealLevel >= 2;
    const needsDetails = canShowVerbDetails(entry);
    return `
      ${revealedTranslation && (!needsDetails || (revealedDetails && item.verbDetailsResult))
        ? `<button class="score-button" data-action="quiz-minus">-</button><button class="score-button primary" data-action="quiz-plus">+</button>`
        : ""}
      ${revealedTranslation && needsDetails && !item.verbTranslationResult
        ? `<button class="score-button labeled" data-action="verb-translation-minus"><strong>-</strong><span>translation</span></button><button class="score-button labeled primary" data-action="verb-translation-plus"><strong>+</strong><span>translation</span></button>`
        : ""}
      ${revealedDetails && needsDetails && item.verbTranslationResult && !item.verbDetailsResult
        ? `<button class="score-button labeled" data-action="verb-details-minus"><strong>-</strong><span>conjugation</span></button><button class="score-button labeled primary" data-action="verb-details-plus"><strong>+</strong><span>conjugation</span></button>`
        : ""}
    `;
  }

  emptyView() {
    if (!this.state.datasets.length) return `<section class="panel"><p>Import a dataset before starting a quiz.</p></section>`;
    if (!this.state.quizSession) return `<section class="panel"><p>Select datasets and start a quiz.</p></section>`;
    return `<section class="panel"><p>Deck complete.</p></section>`;
  }

  trackerView(entriesById) {
    const total = this.state.quizSession.queue.length;
    const completed = Object.values(this.state.quizSession.sessionScores).filter((score) => score >= 5).length;
    return `
      <section class="panel" data-quiz-tracker>
        <h2>Tracker</h2>
        <p data-quiz-tracker-summary>${total} active · ${completed} completed · ${this.state.quizSession.direction}</p>
        <div class="list" data-quiz-tracker-list>
          ${this.trackerRows(entriesById)}
        </div>
      </section>
    `;
  }

  shortcutHelpView() {
    return `<section class="panel"><span class="kbd">Space</span> - · <span class="kbd">Enter</span> - · click card - · <span class="kbd">→</span> + · <span class="kbd">←</span> - · <span class="kbd">Esc</span> exit focus · <span class="kbd">f</span> focus</section>`;
  }
}
