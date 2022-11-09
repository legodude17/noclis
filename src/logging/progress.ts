import { ClientData, Tracker } from "proggy";
import Minipass, { Encoding } from "minipass";

export type ProgressData = ClientData & { parent?: string };

const isArrayBuffer = (b: unknown): b is ArrayBuffer =>
  (b instanceof ArrayBuffer ||
    (typeof b === "object" &&
      b &&
      b.constructor &&
      b.constructor.name === "ArrayBuffer" &&
      // @ts-expect-error byteLength may or may not exist
      b.byteLength >= 0)) ??
  false;

const isArrayBufferView = (b: unknown): b is ArrayBufferView =>
  !Buffer.isBuffer(b) && ArrayBuffer.isView(b);

export default class Progress extends Minipass {
  #tracker: Tracker;
  #parent: string | undefined;
  #value = 0;
  constructor(name: string, key?: string, parent?: string, total?: number) {
    super();
    this.#tracker = new Tracker(name, key ?? name, total ?? 100);
    this.#parent = parent;
  }

  update(value: number, total?: number, metadata: object = {}) {
    this.#value += value;
    this.#value = Math.min(this.#value, this.total);
    this.#tracker.update(this.#value, total ?? this.#tracker.total, {
      parent: this.#parent,
      ...metadata
    });
  }

  finish(metadata: object = {}) {
    this.#tracker.finish({ parent: this.#parent, ...metadata });
  }

  get name() {
    return this.#tracker.name;
  }

  get total() {
    return this.#tracker.total;
  }

  get value() {
    return this.#value;
  }

  get done() {
    return this.#tracker.done;
  }

  override write(
    chunk: Minipass.ContiguousData,
    cb?: (() => void) | undefined
  ): boolean;
  override write(
    chunk: Minipass.ContiguousData,
    encoding?: Minipass.Encoding | undefined,
    cb?: (() => void) | undefined
  ): boolean;
  override write(chunk: unknown, encoding?: unknown, cb?: unknown): boolean {
    if (Buffer.isBuffer(chunk)) {
      this.update(chunk.length);
    } else if (isArrayBuffer(chunk)) {
      this.update(chunk.byteLength);
    } else if (isArrayBufferView(chunk)) {
      this.update(chunk.byteLength);
    } else if (typeof chunk === "string") {
      this.update(chunk.length);
    } else if (this.objectMode) {
      this.update(1);
    }
    return super.write(
      chunk as Minipass.ContiguousData,
      encoding as Encoding | undefined,
      cb as (() => void) | undefined
    );
  }
}
