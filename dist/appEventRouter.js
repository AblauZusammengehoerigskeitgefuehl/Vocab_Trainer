// @ts-nocheck
export class AppEventRouter {
    constructor(context, handlers) {
        this.context = context;
        this.app = context.app;
        this.handlers = handlers;
    }
    bind() {
        this.app.addEventListener("click", this.handlers.onClick);
        this.app.addEventListener("dblclick", this.handlers.onDoubleClick);
        this.app.addEventListener("change", this.handlers.onChange);
        this.app.addEventListener("input", this.handlers.onInput);
        document.addEventListener("keydown", this.handlers.onKeydown);
    }
}
