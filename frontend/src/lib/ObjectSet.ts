export class ObjectSet<T extends Record<string, any>> {
  private set: Set<string>;
  constructor(data?: T[]) {
    this.set = new Set<string>();
    if (data) {
      this.addAll(data);
    }
  }

  public get size() {
    return this.set.size;
  }

  public get setData() {
    return this.set;
  }

  add(data: T) {
    const stringified = JSON.stringify(data);
    return this.set.add(stringified);
  }

  addAll(data: T[]) {
    data.forEach((datum) => {
      const stringified = JSON.stringify(datum);
      this.set.add(stringified);
    });
  }

  delete(data: T) {
    const stringified = JSON.stringify(data);
    return this.set.delete(stringified);
  }

  has(data: T) {
    const stringified = JSON.stringify(data);
    return this.set.has(stringified);
  }

  forEach(cb: (data: T) => void) {
    for (let stringified of this.set) {
      const data = JSON.parse(stringified);
      cb(data);
    }
  }

  getAllData(): T[] {
    const data = [...this.set];
    return data.map((str) => JSON.parse(str));
  }
}
