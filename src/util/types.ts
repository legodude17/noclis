import type { Promisable } from "type-fest";
import { isPromise } from "node:util/types";
import type {
  Stream,
  Writable as WritableStream,
  Readable as ReadableStream
} from "node:stream";

export function isIterable<T>(obj: unknown): obj is Iterable<T> {
  return typeof (obj as never)[Symbol.iterator] === "function";
}

export function isAsyncIterable<T>(obj: unknown): obj is AsyncIterable<T> {
  return typeof (obj as never)[Symbol.asyncIterator] === "function";
}

export function isPromiseLike<T>(obj: Promisable<T>): obj is PromiseLike<T> {
  return isPromise(obj);
}

interface MaybeStream {
  pipe: unknown;
  writable: unknown;
  _write: unknown;
  _writableState: unknown;
  readable: unknown;
  _read: unknown;
  _readableState: unknown;
}

export function isStream(stream: unknown): stream is Stream {
  return (
    stream != undefined &&
    typeof stream === "object" &&
    typeof (stream as MaybeStream).pipe === "function"
  );
}

export function isWritableStream(stream: unknown): stream is WritableStream {
  const temp = stream as MaybeStream;
  return (
    isStream(stream) &&
    temp.writable !== false &&
    typeof temp._write === "function" &&
    typeof temp._writableState === "object"
  );
}

export function isReadableStream(stream: unknown): stream is ReadableStream {
  const temp = stream as MaybeStream;
  return (
    isStream(stream) &&
    temp.readable !== false &&
    typeof temp._read === "function" &&
    typeof temp._readableState === "object"
  );
}
