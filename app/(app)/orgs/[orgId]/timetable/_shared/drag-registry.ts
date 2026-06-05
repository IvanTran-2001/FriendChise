type Handlers = {
  setIsDragging?: (v: boolean) => void;
};

let handlers: Handlers = {};

export function registerDragHandlers(h: Handlers) {
  handlers = h || {};
}

export function unregisterDragHandlers() {
  handlers = {};
}

export function getDragHandlers(): Handlers {
  return handlers;
}

export {};
