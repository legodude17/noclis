import noclis from "./index.js";
import path from "node:path";
import fs from "node:fs/promises";
import type Progress from "./logging/progress.js";
import type { Task } from "./logging/Task.js";
import type { PromptOption } from "./types.js";

const app = noclis(cli =>
  cli
    .command(command =>
      command
        .name("remove")
        .describe("Remove some files")
        .argument(arg =>
          arg
            .name("file")
            .describe("File(s) to remove")
            .type("path")
            .array()
            .required()
        )
        .option(opt =>
          opt
            .name("before")
            .describe("Only remove files created before")
            .type("date")
            .default(new Date())
        )
        .option(opt =>
          opt
            .name("after")
            .describe("Only remove files created after")
            .type("date")
            .default(new Date(0))
        )
        .option(opt =>
          opt
            .name("force")
            .describe("Force the removal")
            .alias("f")
            .type("boolean")
        )
        .option(opt =>
          opt
            .name("recursive")
            .describe("Remove recursivly into directories")
            .alias("r")
            .type("boolean")
        )
    )
    .command(command => command.name("config").desc("Output config"))
    .command(command => command.name("install").desc("Install something"))
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
            .prompt({
              type: "password",
              message: "What is your password?"
            } as PromptOption)
            .required()
        )
    )
    .config("requireCommand", true)
);

const wait = (time: number): Promise<void> =>
  new Promise(res => setTimeout(res, time * 1000));

app.on("remove", () => ({
  name: "Remove",
  handler: (_, args) => [
    args.file.map(file => ({
      name: "Remove " + path.basename(file),
      key: path.basename(file),
      handler: () => fs.rm(file)
    }))
  ]
}));

app.on("config", (a, o) => {
  app.log.verbose("Loading config");
  console.log(a, o);
});

app.on("install", async () => {
  app.log.warn("Outdated version!");
  const d = app.task("Download");
  d.start();
  const ps: Progress[] = [];
  const ts: Task[] = [];
  for (let i = 0; i <= 10; i += 1) {
    ts.push(d.task(`Verify #${i}`));
    d.log.info(`Verifying ${i}`);
    ts[i]!.start();
    d.log.http(`Fetching ${i}`);
    ps.push(ts[i]!.progress(`Fetch #${i}`));
  }
  while (!ps.every(p => p.done)) {
    for (const [i, p] of Object.entries(ps)) {
      if (!p.done) {
        p.update(1);
        d.log.silly(`${p.name}: ${p.value}`);
        if (p.done) ts[+i]!.complete();
      }
    }
    await wait(0.01);
  }
  d.log.notice("Done!");
  d.complete();
});

app.on("login", a => console.log(a));

process.exitCode = (await app.run()) ? 0 : 1;
