// @ts-nocheck
import { pairLabel } from "./core.js";
export class AppShellRenderer {
    constructor(context, callbacks) {
        this.context = context;
        this.app = context.app;
        this.state = context.state;
        this.callbacks = callbacks;
    }
    render() {
        if (this.state.route === "quiz" && this.state.quizFocusMode) {
            this.callbacks.renderQuizFocus();
            return;
        }
        this.renderShell();
        this.updateMessageView();
        this.renderRouteView();
        this.updateNavState();
    }
    renderShell() {
        if (this.app.dataset.mode === "shell" && this.app.querySelector("[data-app-content]"))
            return;
        this.app.dataset.mode = "shell";
        this.app.innerHTML = `
      <div class="shell">
        <aside class="sidebar">
          <div class="brand">Vocab Trainer 101</div>
          <nav class="nav">
            ${this.navButton("learn", "Learn")}
            ${this.navButton("quiz", "Quiz")}
            ${this.navButton("notes", "Library")}
            ${this.navButton("settings", "Settings")}
            <div data-pair-nav>${this.languagePairNav()}</div>
          </nav>
        </aside>
        <main class="content" data-app-content>
          <div data-message></div>
          <section data-view="learn" hidden></section>
          <section data-view="quiz" hidden></section>
          <section data-view="notes" hidden></section>
          <section data-view="settings" hidden></section>
        </main>
      </div>
    `;
        this.context.visibleRoute = null;
    }
    updateNavState() {
        this.app.querySelectorAll("[data-route]").forEach((button) => {
            button.classList.toggle("active", button.dataset.route === this.state.route);
        });
        const pairNav = this.app.querySelector("[data-pair-nav]");
        if (pairNav)
            pairNav.innerHTML = this.languagePairNav();
    }
    updateMessageView() {
        const message = this.app.querySelector("[data-message]");
        if (message)
            message.innerHTML = this.state.message ? `<div class="notice">${this.callbacks.escapeHtml(this.state.message)}</div>` : "";
    }
    renderRouteView() {
        const routeChanged = this.context.visibleRoute !== this.state.route;
        this.app.querySelectorAll("[data-view]").forEach((view) => {
            view.hidden = view.dataset.view !== this.state.route;
        });
        const activeView = this.app.querySelector(`[data-view="${this.state.route}"]`);
        if (!activeView)
            return;
        if (!routeChanged || !activeView.dataset.rendered) {
            activeView.innerHTML = this.callbacks.routeView();
            activeView.dataset.rendered = "true";
            if (!routeChanged) {
                this.app.querySelectorAll("[data-view]").forEach((view) => {
                    if (view !== activeView)
                        delete view.dataset.rendered;
                });
            }
        }
        this.context.visibleRoute = this.state.route;
    }
    navButton(route, label) {
        return `<button data-route="${route}" class="${this.state.route === route ? "active" : ""}">${label}</button>`;
    }
    languagePairNav() {
        if (!this.state.languagePairs.length)
            return "";
        return `
      <div class="pair-nav">
        ${this.state.languagePairs.map((pair) => `
          <button data-action="switch-language-pair" data-pair-id="${pair.id}" class="${this.state.activeLanguagePairId === pair.id ? "active" : ""}">
            ${this.callbacks.escapeHtml(pairLabel(pair))}
          </button>
        `).join("")}
      </div>
    `;
    }
}
