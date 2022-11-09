import type { AppOptions } from "../App.js";
import { readdir, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import Minipass from "minipass";
import { WriteStream } from "fs-minipass";
import log from "proc-log";

export default class LogFile {
  #stream: Minipass;
  #options: AppOptions;
  #files: string[] = [];
  #fileLogCount = 0;
  #totalLogCount = 0;
  #id = Date.now();
  #handler: (str: string) => void;
  constructor(options: AppOptions) {
    this.#options = options;
    this.#stream = new Minipass();
    this.#handler = this.#output.bind(this);
  }
  async start() {
    await mkdir(this.#logDir, { recursive: true });
    this.#stream = this.#stream.pipe(this.#openLogFile());
    process.on("output", this.#handler);
    return this.#cleanLogs();
  }
  stop() {
    this.#stream.end("---END---");
  }
  get #logDir() {
    return join(this.#options.logDir, this.#id.toFixed(0));
  }
  get #isBuffered() {
    return !(this.#stream instanceof WriteStream);
  }
  #output(str: string) {
    this.#fileLogCount++;
    this.#totalLogCount++;
    const toWrite = `${this.#totalLogCount} ${str}\n`;
    if (
      !this.#isBuffered &&
      this.#fileLogCount >= this.#options.maxLogsPerFile
    ) {
      if (this.#files.length < this.#options.maxLogFiles) {
        this.#stream.end(toWrite);
        this.#stream = this.#openLogFile();
        this.#fileLogCount = 0;
      } else {
        log.warn("logfile", "Log limit reached, disabling log file");
        process.off("output", this.#handler);
      }
    } else {
      this.#stream.write(toWrite);
    }
  }
  #openLogFile() {
    const count = this.#files.length;
    const newFile = join(this.#logDir, `debug-${count}.log`);
    this.#files.push(newFile);
    return new WriteStream(newFile);
  }
  async #cleanLogs() {
    const contents = await readdir(this.#options.logDir);
    return Promise.all(
      contents
        .map(p => join(this.#options.logDir, p))
        .filter(p => p !== this.#logDir)
        .map(p => rm(p, { recursive: true }))
    );
  }
}
