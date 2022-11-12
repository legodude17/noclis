import noclis from "./index.js";
import type { PromptOption } from "./types.js";

const app = noclis(cli =>
  cli
    .option(opt =>
      opt
        .name("rwpath")
        .desc("Path to RimWorld")
        .type("path")
        .prompt({
          type: "input",
          message: "What's the path to your RimWorld installation?"
        } as PromptOption)
    )
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

app.on("login", a => console.log(a));

process.exitCode = (await app.run()) ? 0 : 1;
