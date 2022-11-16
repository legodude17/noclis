import noclis from "./index.js";
import type { PromptOption } from "./types.js";

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
    }
  ]
}));

process.exitCode = (await app.run()) ? 0 : 1;
