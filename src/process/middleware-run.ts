import { middlewareCompileFn } from "../builders/middleware-cmp";
import chalk from "chalk";

const {
  FOLDER_ROOT,
  OUTPUT_ROOT,
  FORCE,
  ENABLED,
  CHANGES,
  __TSCONFIG
} = process.env;

try {
  const changes: string[] = JSON.parse(CHANGES!);
  const results = middlewareCompileFn({
    tsconfig: __TSCONFIG === "-" ? undefined : __TSCONFIG,
    rootFolder: FOLDER_ROOT === "-" ? undefined : FOLDER_ROOT,
    outFolder: OUTPUT_ROOT === "-" ? undefined : OUTPUT_ROOT,
    enabled: String(ENABLED) === "true" ? true : false,
    force: String(FORCE) === "true" ? true : false,
    fileList: changes || []
  });
  results.forEach(each => {
    console.log(chalk.blueBright(each));
  });
  console.log(chalk.cyanBright(`\nCOUNT : [${results.length}]`));
  console.log("");
} catch (e) {
  throw e;
}
