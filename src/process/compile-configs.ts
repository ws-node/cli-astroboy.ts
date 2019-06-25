import chalk from "chalk";
import * as ts from "typescript";
import { compileFn } from "../builders/config-compiler";
import { CancellationToken as CT } from "../utils/cancellation-token";

const {
  CONFIG_ROOT,
  OUTPUT_ROOT,
  FORCE,
  ENABLED,
  CHANGES,
  __TSCONFIG,
  USE_CANCEL
} = process.env;

async function run(ct?: CT) {
  let results: string[] = [];
  try {
    if (ct) {
      ct.throwIfCancellationRequested();
    }
    const changes: string[] = JSON.parse(CHANGES!);
    results = compileFn({
      tsconfig: __TSCONFIG === "-" ? undefined : __TSCONFIG,
      configRoot: CONFIG_ROOT === "-" ? undefined : CONFIG_ROOT,
      outRoot: OUTPUT_ROOT === "-" ? undefined : OUTPUT_ROOT,
      enabled: String(ENABLED) === "true" ? true : false,
      force: String(FORCE) === "true" ? true : false,
      fileList: changes || []
    });
  } catch (e) {
    if (e instanceof ts.OperationCanceledException) {
      return;
    }
    throw e;
  }

  if (!ct || !ct.isCancellationRequested()) {
    results.forEach(each => {
      console.log(chalk.blueBright(each));
    });
    console.log(chalk.cyanBright(`\nCOUNT : [${results.length}]`));
    console.log("");
    process.exit();
  }
}

if (USE_CANCEL === "true") {
  process.on("message", message => {
    run(CT.createFromJSON(ts, message));
  });

  process.on("SIGINT", () => {
    process.exit();
  });
} else {
  run();
}
