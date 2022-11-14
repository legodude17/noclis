import Minipass, { Encoding } from "minipass";

export default class LineStream extends Minipass {
  #data: Buffer = Buffer.alloc(4096);
  #length = 0;

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
    let enc: Encoding, callback: () => void;
    if (typeof encoding === "function") {
      callback = encoding as () => void;
      enc = "utf8";
    } else {
      enc = encoding as Encoding;
      callback = cb as () => void;
    }

    const c = Buffer.isBuffer(chunk)
      ? chunk
      : // @ts-expect-error Weirdness
        Buffer.from(chunk as string, enc);

    const num = c.copy(this.#data, this.#length);
    while (this.#length < this.#length + num) {
      if (this.#data[this.#length] === 10 || this.#data[this.#length] === 13) {
        const result = this.#data.subarray(0, this.#length - 1);
        this.#data = this.#data.subarray(this.#length - 1);
        return super.write(result, enc, callback);
      }
      this.#length++;
    }
    return true;
  }
}
