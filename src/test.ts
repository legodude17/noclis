import path from "node:path";
import noclis from "./index.js";
import type { PromptOption } from "./types.js";
import fs from "node:fs/promises";
import crypto from "node:crypto";

const app = noclis(cli =>
  cli
    .command(command =>
      command
        .name("login")
        .desc("Log in to the service")
        .argument(arg =>
          arg
            .name("username")
            .desc("Username to login with")
            .type("string")
            .prompt({
              type: "input",
              message: "What is your username?"
            } as PromptOption)
            .required()
        )
        .argument(arg =>
          arg
            .name("password")
            .desc("Password to login with")
            .type("string")
            .default(() => crypto.pseudoRandomBytes(15).toString())
            .prompt({
              type: "password",
              message: "What is your password?"
            } as PromptOption)
            .required()
        )
    )
    .config("requireCommand", true)
);

const wait = (n: number) => (): Promise<string> =>
  new Promise(res => setTimeout(() => res(`Waited ${n} seconds`), n * 1000));

app.on("login", () => ({
  name: "Do the thing",
  key: "do",
  handler: () => [
    {
      name: "Step 1",
      key: "1",
      handler: wait(1)
    },
    {
      name: "Step 2",
      key: "2",
      async handler(task) {
        const pkg = path.resolve("package.json");
        task.message("Found at " + pkg);
        const fd = await fs.open(pkg);
        const stat = await fd.stat();
        const buffer = Buffer.alloc(stat.size);
        let idx = 0;
        const p = task.progress("Read package.json", "pkg", stat.size);
        while (!p.done) {
          const { bytesRead } = await fd.read(buffer, idx, 8);
          idx += bytesRead;
          p.update(idx, stat.size);
          await wait(0.1)();
        }
      }
    }
  ]
}));

process.exitCode = (await app.run()) ? 0 : 1;
