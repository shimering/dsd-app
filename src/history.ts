export class History<T> {
  private past: T[] = [];
  private future: T[] = [];
  constructor(private limit = 60) {}
  record(value: T) {
    this.past.push(structuredClone(value));
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  undo(current: T) {
    const previous = this.past.pop();
    if (previous) {
      this.future.push(structuredClone(current));
      return previous;
    }
    return null;
  }
  redo(current: T) {
    const next = this.future.pop();
    if (next) {
      this.past.push(structuredClone(current));
      return next;
    }
    return null;
  }
  clear() {
    this.past = [];
    this.future = [];
  }
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
}
