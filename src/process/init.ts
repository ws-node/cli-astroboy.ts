import { preInitFn } from "../cmd";
import chalk from "chalk";

const {
  CTOR_PATH,
  ROUTER_PATH,
  ASTT_ENABLED,
  ASTT_ALWAYS,
  APP_ROOT,
  FILE_TYPE,
  SHOW_ROUTERS
} = process.env;

// @ts-ignore
preInitFn(
  {
    enabled: ASTT_ENABLED === "true",
    always: ASTT_ALWAYS === "true",
    fileType: <any>FILE_TYPE,
    appRoot: APP_ROOT,
    ctorFolder: CTOR_PATH,
    routerFolder: ROUTER_PATH
  },
  ({ routers, error }: any) => {
    if (error) {
      throw error;
    } else {
      if (SHOW_ROUTERS === "true") {
        const count = showRoutes(routers);
        console.log(chalk.cyanBright(`\nCOUNT : [${count}]`));
        console.log("");
      }
    }
  }
);

function showRoutes(obj: any, preK?: string) {
  let count = 0;
  Object.keys(obj || {}).forEach(k => {
    if (typeof obj[k] === "string") {
      console.log(chalk.blueBright(!preK ? `--> ${k}` : `--> ${preK}/${k}`));
      count += 1;
    } else {
      count += showRoutes(obj[k], !preK ? k : `${preK}/${k}`);
    }
  });
  return count;
}
