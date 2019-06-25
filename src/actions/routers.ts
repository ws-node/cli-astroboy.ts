import path from "path";
import get from "lodash/get";
import chalk from "chalk";
import { loadConfig } from "../utils/load-config";
import { CommandPlugin, RouterConfig, IntergradeOptions } from "../base";
import { startChildProcess } from "../utils/execChild";
import { TRANSFROM } from "../utils/transform";
import { CancellationToken } from "../utils/cancellation-token";

export interface IRouterCmdOptions {
  config?: string;
  enabled?: boolean;
  always?: boolean;
  filetype?: string;
  approot?: string;
  details?: string;
  tsconfig?: string;
}

export const RouterPlugin: CommandPlugin = {
  name: "router",
  description: "astroboy.ts routers cmd",
  options: [
    ["-C, --config [atcConfig]", "use atc.config.js"],
    ["-E, --enabled [isEnabled]", "open routers-auto-build"],
    ["-A, --always [isAlways]", "set routers-always-rebuild"],
    ["-F, --filetype [fileType]", "set routers fileType"],
    ["-R, --approot [appRoot]", "set routers-root"],
    ["-T, --tsconfig [tsconfig]", "set tsconfig.json"],
    ["-D, --details [showRouters]", "show building results or not"]
  ],
  help: () => {
    console.log("");
    console.log("  Examples:");
    console.log("");
    console.log("    $ atc router");
    console.log("    $ atc router --always");
    console.log("    $ atc router --fileType ts");
    console.log("    $ atc router --approot /v1/prj");
    console.log();
  },
  action(_, command: IRouterCmdOptions) {
    if (_ !== "router") return;
    console.log(chalk.green("========= [ASTROBOY.TS] <==> ROUTER ========\n"));
    const fileName = command.config || "atc.config.js";
    console.log(
      `${chalk.white("🤨 - TRY LOAD FILE : ")}${chalk.yellow(fileName)}`
    );
    const projectRoot = process.cwd();
    let config: RouterConfig;
    const defaultConfigs = {
      ...TRANSFROM.routers({}),
      details: true,
      enabled: true
    };
    try {
      const req = loadConfig(projectRoot, fileName);
      config = {
        ...defaultConfigs,
        ...get(req, "routers", {}),
        tsconfig: req.tsconfig || "tsconfig.json"
      };
    } catch (_) {
      config = defaultConfigs;
    }

    if (command.tsconfig) config.tsconfig = command.tsconfig;
    if (command.enabled) config.enabled = String(command.enabled) === "true";
    if (command.always) config.always = String(command.always) === "true";
    if (command.details) config.details = String(command.details) === "true";
    if (command.approot) config.approot = command.approot;
    if (command.filetype) {
      config.filetype = command.filetype === "js" ? "js" : "ts";
    }

    runRoutersBuilder(projectRoot, config);
  }
};

export function runRoutersBuilder(
  projectRoot: string,
  config: RouterConfig,
  intergradeOptions: IntergradeOptions<CancellationToken> = {},
  then?: (success: boolean, error?: Error) => void
) {
  const { type = "spawn", token, defineCancel } = intergradeOptions;
  try {
    const tsnode = require.resolve("ts-node");
    console.log("");
    console.log(chalk.cyan("⛺️ - BUILDING ROUTERS"));
    console.log("");
    const registerFile = path.resolve(__dirname, "../register");
    const initFile = path.resolve(__dirname, "../process/init");
    console.log(`root  ==> "${chalk.green("app/controllers")}"`);
    startChildProcess({
      type,
      token,
      defineCancel,
      script: initFile,
      args: type === "fork" ? [] : ["-r", registerFile, initFile],
      env: {
        CTOR_PATH: path.resolve(projectRoot, "app/controllers"),
        ROUTER_PATH: path.resolve(projectRoot, "app/routers"),
        ASTT_ENABLED:
          config.enabled === undefined
            ? "true"
            : String(!!config.enabled === true),
        ASTT_ALWAYS: String(!!config.always),
        APP_ROOT: config.approot || "",
        FILE_TYPE: config.filetype || "js",
        SHOW_ROUTERS: String(!!config.details),
        __TSCONFIG: config.tsconfig || "_"
      }
    })
      .then(() => {
        console.log(chalk.green("✅ - BUILD ROUTERS OVER"));
        then && then(true);
      })
      .catch(error => {
        console.log(chalk.yellow("❌ - BUILD ROUTERS FAILED"));
        console.log("");
        if (then) {
          return then(false, error);
        }
        console.log(chalk.red(error));
      });
  } catch (e) {
    console.log(chalk.yellow("❌ - BUILD ROUTERS FAILED"));
    if (((<Error>e).message || "").includes("ts-node")) {
      console.log(chalk.red("NEED TS-NODE"));
      return;
    }
    throw e;
  }
}

function showRoutes(obj: any, preK?: string) {
  let count = 0;
  Object.keys(obj || {}).forEach(k => {
    if (typeof obj[k] === "string") {
      console.log(chalk.blue(!preK ? `--> ${k}` : `--> ${preK}/${k}`));
      count += 1;
    } else {
      count += showRoutes(obj[k], !preK ? k : `${preK}/${k}`);
    }
  });
  return count;
}
