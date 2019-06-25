import fs from "fs";
import path from "path";
import ts from "typescript";
import { loadProgramConfig, createProgram } from "../utils/type-check";
import {
  ICompileContext,
  compileForEach,
  ImportsHelper
} from "../utils/ast-compiler";
import chalk from "chalk";

export interface ConfigCompilerOptions {
  /** tsconfig, 默认：`undefined` */
  tsconfig?: string;
  /** 是否自动编译configs文件夹，默认：`false` */
  enabled: boolean;
  /** 是否强制编译configs文件夹，默认：`false` */
  force: boolean;
  /** 整个configs文件夹的相对位置，默认：`'config'` */
  configRoot?: string;
  /** 整个configs文件夹编译后的输出位置，默认：`'config'` */
  outRoot?: string;
}

export interface InnerConfigCompilerOptions extends ConfigCompilerOptions {
  fileList?: string[];
}

export const defaultConfigCompilerOptions: ConfigCompilerOptions = {
  tsconfig: undefined,
  enabled: false,
  force: false,
  configRoot: "app/config",
  outRoot: "config"
};

export function compileFn(
  options: Partial<InnerConfigCompilerOptions>
): string[] {
  const {
    enabled = false,
    force = false,
    configRoot,
    outRoot,
    tsconfig,
    // 支持增量编译
    fileList = []
  } = options;
  if (!enabled) return [];
  try {
    const cwd = process.cwd();
    const configFolder = path.resolve(
      cwd,
      configRoot || defaultConfigCompilerOptions.configRoot!
    );
    const outputFolder = path.resolve(
      cwd,
      outRoot || defaultConfigCompilerOptions.outRoot!
    );
    if (!fs.existsSync(configFolder)) fs.mkdirSync(configFolder);
    const watchedFiles = fileList.filter(findTsFiles);
    const useHMR = watchedFiles.length > 0;
    console.log(`root  ==> "${chalk.green(configRoot!)}"`);
    console.log(`force ==> ${chalk.magenta(String(!!force))}`);
    console.log(`HMR   ==> ${chalk.magenta(String(!!useHMR))}`);
    console.log("");
    if (useHMR) {
      const valid = watchedFiles.every(p => p.startsWith(configFolder));
      if (!valid) {
        throw new Error(
          "Config-Compiler Error: paths of HMR changed files must startsWith configFolder."
        );
      }
    }
    const files = !useHMR
      ? initCompilePreSteps(configFolder, force, outputFolder)
      : watchedFiles.map(each => path.relative(configFolder, each));
    const compileds: string[] = [];
    const options = loadProgramConfig(tsconfig!, {
      noEmit: true,
      skipLibCheck: true
    });
    let program: ts.Program;
    program = createTSCompiler(
      options,
      files.map(i => `${configFolder}/${i}`),
      program
    );
    files.forEach(filePath => {
      const sourcePath = `${configFolder}/${filePath}`;
      const compiledPath = `${outputFolder}/${filePath.replace(
        /\.ts$/,
        ".js"
      )}`;
      const file = program.getSourceFile(sourcePath);
      const context = createContext(configFolder, outputFolder);
      compileForEach(file!, context);
      const exports = require(sourcePath);
      if (!exports) return;
      let finalExports: any;
      const procedures: string[] = [];
      if (typeof exports === "function") {
        finalExports = exports;
      } else if (typeof exports === "object") {
        const { default: excuClass, ...others } = exports;
        if (typeof excuClass !== "function") {
          throw new Error(
            "Config-Compiler Error: default exports must be a function."
          );
        } else {
          finalExports = excuClass;
          Object.keys(others || {}).forEach(name => {
            if (typeof others[name] === "function" && !!others[name].name) {
              procedures.push(others[name].toString());
            }
          });
        }
      } else {
        throw new Error(
          "Config-Compiler Error: exports must be a function or object."
        );
      }
      const imports = ImportsHelper.toList(context, "js");
      const preRuns = [
        "// [astroboy.ts] 自动生成的代码",
        ...imports,
        ...procedures
      ];
      const exportStr = `${preRuns.join(
        "\n"
      )}\nmodule.exports = (${finalExports.toString()})();`;
      if (!!force || !fs.existsSync(compiledPath) || useHMR) {
        fs.appendFileSync(compiledPath, exportStr, { flag: "w" });
        return compileds.push(compiledPath);
      }
      const oldFile = fs.readFileSync(compiledPath, { flag: "r" });
      if (oldFile.toString() !== exportStr) {
        fs.appendFileSync(compiledPath, exportStr, { flag: "w" });
        compileds.push(compiledPath);
      } else {
        return;
      }
    });
    return compileds;
  } catch (error) {
    throw error;
  }
}

function createContext(
  configFolder: string,
  outputFolder: string
): ICompileContext {
  return {
    main: { root: configFolder, out: outputFolder },
    imports: {},
    functions: {},
    exports: {}
  };
}

function createTSCompiler(
  options: ts.ParsedCommandLine,
  sourcePaths: string[],
  program: ts.Program
): ts.Program {
  return createProgram(
    {
      ...options,
      fileNames: sourcePaths
    },
    program
  );
}

function initCompilePreSteps(
  configFolder: string,
  force: boolean,
  outputFolder: string
) {
  const files = fs.readdirSync(configFolder);
  if (!!force && fs.existsSync(outputFolder)) {
    if (configFolder === outputFolder) {
      throw new Error(
        "Config-Compiler Error: same config-root and output-root is invalid when [force] option is opened."
      );
    }
    // 硬核开关，强撸config文件夹
    const exists = fs.readdirSync(outputFolder);
    exists
      .filter(p => p.endsWith(".js"))
      .forEach(p => {
        fs.unlinkSync(`${outputFolder}/${p}`);
      });
  } else if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder);
  }
  return files.filter(findTsFiles);
}

function findTsFiles(i: string): any {
  return i.endsWith(".ts") && !i.endsWith(".d.ts");
}
