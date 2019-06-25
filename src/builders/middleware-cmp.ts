import path from "path";
import fs from "fs";
import ts from "typescript";
import { loadProgramConfig, createProgram } from "../utils/type-check";
import {
  ICompileContext,
  compileForEach,
  IFuncParam,
  ImportsHelper,
  ImportStyle
} from "../utils/ast-compiler";
import chalk from "chalk";

export interface MiddlewareCompilerOptions {
  /** tsconfig, 默认：`undefined` */
  tsconfig?: string;
  /** 是否自动编译configs文件夹，默认：`false` */
  enabled: boolean;
  /** 是否强制编译configs文件夹，默认：`false` */
  force: boolean;
  /** class-middlewares文件夹的相对位置，默认：`'app/middlewares/class'` */
  rootFolder?: string;
  /** middlewares编译后的输出位置，默认：`'app/middlewares'` */
  outFolder?: string;
}

export interface InnerMiddlewareCompilerOptions
  extends MiddlewareCompilerOptions {
  fileList?: string[];
}

export const defaultConfigCompilerOptions: MiddlewareCompilerOptions = {
  enabled: false,
  force: false,
  tsconfig: undefined,
  rootFolder: "middlewares",
  outFolder: "app/middlewares"
};

type ImportsIndex = [number, string];

export function middlewareCompileFn(
  options: Partial<InnerMiddlewareCompilerOptions>
): string[] {
  const {
    enabled = false,
    force = false,
    rootFolder,
    outFolder,
    tsconfig,
    fileList = []
  } = options;
  if (!enabled) return [];
  try {
    const cwd = process.cwd();
    const middleRootFolder = path.resolve(
      cwd,
      rootFolder || defaultConfigCompilerOptions.rootFolder!
    );
    const outputFolder = path.resolve(
      cwd,
      outFolder || defaultConfigCompilerOptions.outFolder!
    );
    const EXTENSIONS = !!force ? ".ts" : ".js";
    if (!fs.existsSync(middleRootFolder)) fs.mkdirSync(middleRootFolder);
    const watchedFiles = fileList.filter(findTsFiles);
    const useHMR = watchedFiles.length > 0;
    console.log(`root  ==> "${chalk.green(rootFolder!)}"`);
    console.log(`force ==> ${chalk.magenta(String(!!force))}`);
    console.log(`HMR   ==> ${chalk.magenta(String(!!useHMR))}`);
    console.log("");
    if (useHMR) {
      const valid = watchedFiles.every(p => p.startsWith(middleRootFolder));
      if (!valid) {
        throw new Error(
          "Middleware-Compiler Error: paths of HMR changed files must startsWith rootFolder."
        );
      }
    }
    const files = !useHMR
      ? initCompilePreSteps(middleRootFolder, force, outputFolder, EXTENSIONS)
      : watchedFiles.map(each => path.relative(rootFolder!, each));
    const compileds: string[] = [];
    const options = loadProgramConfig(tsconfig!, {
      noEmit: true,
      skipLibCheck: true
    });
    let program: ts.Program;
    program = createTSCompiler(
      options,
      files.map(i => `${middleRootFolder}/${i}`),
      program
    );
    files.forEach(filePath => {
      const sourcePath = `${middleRootFolder}/${filePath}`;
      const compiledPath = `${outputFolder}/${filePath.replace(
        /\.ts$/,
        EXTENSIONS
      )}`;
      const file = program.getSourceFile(sourcePath);
      const context = createContext(middleRootFolder, outputFolder);
      compileForEach(file!, context);
      const exportList = Object.keys(context.exports);
      if (exportList.length <= 0) return;
      const exports = require(sourcePath);
      if (!exports) return;
      let finalExports: (...args: any[]) => any;
      const otherFuncs: Array<(...args: any[]) => any> = [];
      if (typeof exports !== "object" && typeof exports !== "function") {
        throw new Error(
          "Middleware-Compiler Error: a middleware function must be exported."
        );
      }
      if (typeof exports === "object") {
        const { default: excuClass, ...others } = exports;
        if (typeof excuClass !== "function") {
          throw new Error(
            "Middleware-Compiler Error: a middleware function must be exported."
          );
        } else {
          finalExports = excuClass;
          Object.keys(others || {}).forEach(name => {
            if (typeof others[name] === "function" && !!others[name].name) {
              otherFuncs.push(others[name].toString());
            }
          });
        }
      } else {
        finalExports = exports;
      }
      if (!finalExports.name) {
        throw new Error(
          "Middleware-Compiler Error: exported function must have a name."
        );
      }
      const exportStr = (!!force ? createTsFile : createJsFile)(
        otherFuncs,
        finalExports,
        context
      );
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
    console.log(chalk.red(error.message || ""));
    throw error;
  }
}

function createContext(
  middleRootFolder: string,
  outputFolder: string
): ICompileContext {
  return {
    main: { root: middleRootFolder, out: outputFolder },
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
  middleRootFolder: string,
  force: boolean,
  outputFolder: string,
  EXTENSIONS: string
) {
  const files = fs.readdirSync(middleRootFolder);
  if (!!force && fs.existsSync(outputFolder)) {
    if (middleRootFolder === outputFolder) {
      throw new Error(
        "Middleware-Compiler Error: same root-folder and out-folder is invalid when [force] option is opened."
      );
    }
    // 硬核开关，强撸中间件文件夹
    const exists = fs.readdirSync(outputFolder);
    exists
      .filter(p => p.endsWith(".js") || p.endsWith(EXTENSIONS))
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

function createJsFile(
  otherFuncs: ((...args: any[]) => any)[],
  finalExports: (...args: any[]) => any,
  context: ICompileContext
) {
  const imports = ImportsHelper.toJsList(context);
  const targetFunc = context.functions[finalExports.name];
  const { params, valid } = resolveParamsData(targetFunc);
  if (!valid) {
    throw new Error(
      "Middleware-Compiler Error: invalid middleware function params type."
    );
  }
  const procedures: ImportsIndex[] = [];
  procedures.push([0, "// [astroboy.ts] 自动生成的代码"]);
  if (params.length > 0) {
    procedures.push([
      ImportStyle.Named,
      `const { injectScope } = require("astroboy.ts");`
    ]);
  }
  procedures.push(...imports);
  procedures.push(...otherFuncs.map<ImportsIndex>(i => [8, i.toString()]));
  procedures.push([9, finalExports.toString()]);
  const finalSorted = procedures.sort((a, b) => a[0] - b[0]).map(i => i[1]);
  const actions: string[] = [
    createInjectActions(params, context),
    createAwaitMiddlewareAction(finalExports.name, params)
  ];
  const exportStr =
    params.length > 0
      ? createDIMiddleware(finalSorted, actions)
      : createCommonMiddleware(finalSorted, finalExports.name);
  return exportStr;
}

function createTsFile(
  otherFuncs: ((...args: any[]) => any)[],
  finalExports: (...args: any[]) => any,
  context: ICompileContext
) {
  const imports = ImportsHelper.toTsList(context);
  const targetFunc = context.functions[finalExports.name];
  const { params, valid } = resolveParamsData(targetFunc);
  if (!valid) {
    throw new Error(
      "Middleware-Compiler Error: invalid middleware function params type."
    );
  }
  const procedures: ImportsIndex[] = [];
  procedures.push([0, "// [astroboy.ts] 自动生成的代码"]);
  if (params.length > 0) {
    procedures.push([
      ImportStyle.Named,
      `import { injectScope, IMiddlewaresScope } from "astroboy.ts";`
    ]);
  }
  procedures.push(...imports);
  procedures.push(...otherFuncs.map<ImportsIndex>(i => [8, i.toString()]));
  procedures.push([9, finalExports.toString()]);
  const finalSorted = procedures.sort((a, b) => a[0] - b[0]).map(i => i[1]);
  const actions: string[] = [
    createInjectActions(params, context),
    createAwaitMiddlewareAction(finalExports.name, params)
  ];
  const exportStr =
    params.length > 0
      ? createDIMiddleware(finalSorted, actions, true)
      : createCommonMiddleware(finalSorted, finalExports.name, true);
  return exportStr;
}

function resolveParamsData(targetFunc: { name: string; params: IFuncParam[] }) {
  const sourceParams = (targetFunc && targetFunc.params) || [];
  /** 类型参数，DI类型 */
  const params = sourceParams.filter(i => i.type !== "[unknown type]") || [];
  return {
    params,
    sourceParams,
    /**
     * 中间件函数是否合法
     * * valid：存在DI参数，且所有参数都可以被DI
     * * valid：不存在DI参数
     */
    valid:
      (params.length > 0 && params.length === sourceParams.length) ||
      params.length === 0
  };
}

function createCommonMiddleware(
  procedures: string[],
  funcName: string,
  isTs = false
) {
  if (isTs) {
    return (
      `${procedures.join(
        "\n"
      )}\nexport = (options: any = {}, app: any) => async (ctx: any, next: any) => {\n    ` +
      `return await ${funcName}(<any>{ ctx, options, app, next });\n};`
    );
  }
  return (
    `${procedures.join(
      "\n"
    )}\nmodule.exports = (options = {}, app) => async (ctx, next) => {\n    ` +
    `return await ${funcName}({ ctx, options, app, next });\n};`
  );
}

function createDIMiddleware(
  procedures: string[],
  actions: string[],
  isTs = false
) {
  if (isTs) {
    return (
      `${procedures.join("\n")}\nexport = (options: any = {}, app: any) => ` +
      `injectScope(async ({ injector, next }: IMiddlewaresScope) => {\n${actions.join(
        "\n"
      )}\n});`
    );
  }
  return (
    `${procedures.join("\n")}\nmodule.exports = (options = {}, app) => ` +
    `injectScope(async ({ injector, next }) => {\n${actions.join("\n")}\n});`
  );
}

function createInjectActions(params: IFuncParam[], context: ICompileContext) {
  return params
    .map(p => {
      const typeName = p.typeName;
      let result: string;
      if (p.type === "directType") {
        result = resolveIdentity(typeName, context);
      } else {
        result = `${resolveIdentity(p.namespace!, context, typeName)}`;
      }
      return `  const _p${p.paramIndex} = injector.get(${result});`;
    })
    .join("\n");
}

function resolveIdentity(
  typeName: string,
  context: ICompileContext,
  replace?: string
) {
  const target = Object.keys(context.imports)
    .map(i => context.imports[i])
    .find(i => i.name.includes(typeName));
  if (target) {
    return `${target.identity}${
      target.type === ImportStyle.Namespace ? ".default." : "."
    }${replace || typeName}`;
  }
  return "";
  // throw new Error("Middleware-Compiler Error: resolve inject token failed.");
}

function createAwaitMiddlewareAction(
  middlewareName: string,
  params: IFuncParam[]
) {
  return `  await ${middlewareName}.call({ next, options, app }, ${params
    .map(p => `_p${p.paramIndex}`)
    .join(", ")});`;
  // return `  await (${middlewareName}.bind({ next }))(${params
  //   .map(p => `_p${p.paramIndex}`)
  //   .join(", ")});`;
}
