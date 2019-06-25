import path from "path";
import chalk from "chalk";
import get from "lodash/get";
import { loadConfig } from "../utils/load-config";
import { MiddlewareCompilerCmdConfig, IntergradeOptions } from "../base";
import { CommandPlugin } from "../base";
import { startChildProcess } from "../utils/execChild";
import { TRANSFROM } from "../utils/transform";
import { CancellationToken } from "../utils/cancellation-token";

export interface IMiddlewareCmdOptions {
  force?: boolean;
  config?: string;
}

export const MiddlewarePlugin: CommandPlugin = {
  name: "middleware",
  description: "编译middlewares文件",
  options: [["-F, --force", "清除所有middlewares，并重新编译"]],
  help: () => {
    console.log("");
    console.log("  Examples:");
    console.log("");
    console.log("    $ atc middleware");
    console.log("    $ atc middleware --force");
    console.log();
  },
  action(_, command: IMiddlewareCmdOptions) {
    if (_ !== "middleware") return;
    console.log(
      chalk.green("========= [ASTROBOY.TS] <==> MIDDLEWARES ========\n")
    );
    const projectRoot = process.cwd();
    const fileName = command.config || "atc.config.js";
    console.log(
      `${chalk.white("🤨 - TRY LOAD FILE : ")}${chalk.yellow(fileName)}`
    );

    let config: MiddlewareCompilerCmdConfig;
    const defaultConfigs = TRANSFROM.middlewares({});
    try {
      const req = loadConfig(projectRoot, fileName);
      config = {
        ...defaultConfigs,
        ...get(req, "middlewareCompiler", {}),
        tsconfig: req.tsconfig || defaultConfigs.tsconfig
      };
    } catch (_) {
      config = defaultConfigs;
    }

    if (command.force) config.force = String(command.force) === "true";
    if (command.config) config.tsconfig = String(command.config);

    runMiddlewareCompile(projectRoot, config);
  }
};

export function runMiddlewareCompile(
  projectRoot: string,
  config: MiddlewareCompilerCmdConfig,
  intergradeOptions: IntergradeOptions<CancellationToken> = {},
  then?: (success: boolean, error?: Error) => void
) {
  const {
    changes = [],
    type = "spawn",
    token,
    defineCancel
  } = intergradeOptions;
  try {
    const tsnode = require.resolve("ts-node");
    console.log("");
    console.log(chalk.cyan("🚄 - CONPILE MIDDLEWARES"));
    console.log("");
    const registerFile = path.resolve(__dirname, "../register");
    const initFile = path.resolve(__dirname, "../process/middleware-run");
    startChildProcess({
      type,
      token,
      defineCancel,
      script: initFile,
      args: type === "fork" ? [] : ["-r", registerFile, initFile],
      env: {
        FOLDER_ROOT: config.root || "-",
        OUTPUT_ROOT: config.output || "-",
        FORCE: String(config.force === true),
        ENABLED: String(config.enabled === true),
        CHANGES: JSON.stringify(changes || []),
        __TSCONFIG: path.resolve(
          projectRoot,
          config.tsconfig || "tsconfig.json"
        )
      }
    })
      .then(() => {
        console.log(chalk.green("✅ - COMPILE MIDDLEWARES OVER"));
        then && then(true);
      })
      .catch(error => {
        console.log(chalk.yellow("❌ - COMPILE MIDDLEWARES FAILED"));
        console.log("");
        if (then) {
          return then(false, error);
        }
        console.log(chalk.red(error));
      });
  } catch (e) {
    console.log(chalk.yellow("❌ - COMPILE MIDDLEWARES FAILED"));
    if (((<Error>e).message || "").includes("ts-node")) {
      console.log(chalk.red("NEED TS-NODE"));
      return;
    }
    throw e;
  }
}
