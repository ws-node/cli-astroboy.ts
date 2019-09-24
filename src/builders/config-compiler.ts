import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import { ts, visitCompile } from "../compiler/core";
import { transformImportsPath, wrapAutoRunFunction } from "../compiler/statements";

export interface IConfigCompilerOptions {
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

export interface IInnerConfigCompilerOptions extends IConfigCompilerOptions {
  fileList?: string[];
}

export const defaultConfigCompilerOptions: IConfigCompilerOptions = {
  tsconfig: undefined,
  enabled: false,
  force: false,
  configRoot: "app/config",
  outRoot: "config"
};

export function compileFn(options: Partial<IInnerConfigCompilerOptions>): string[] {
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
    const configFolder = path.resolve(cwd, configRoot || defaultConfigCompilerOptions.configRoot!);
    const outputFolder = path.resolve(cwd, outRoot || defaultConfigCompilerOptions.outRoot!);
    if (!fs.existsSync(configFolder)) fs.mkdirSync(configFolder, { recursive: true });
    const watchedFiles = fileList.filter(findTsFiles);
    const useHMR = watchedFiles.length > 0;
    console.log(`root  ==> "${chalk.green(configRoot!)}"`);
    console.log(`force ==> ${chalk.magenta(String(!!force))}`);
    console.log(`incre ==> ${chalk.magenta(String(!!useHMR))}`);
    console.log("");
    if (useHMR) {
      const valid = watchedFiles.every(p => p.startsWith(configFolder));
      if (!valid) {
        throw new Error("Config-Compiler Error: paths of increment changed files must startsWith configFolder.");
      }
    }
    const files = !useHMR
      ? initCompilePreSteps(configFolder, force, outputFolder)
      : watchedFiles.map(each => path.relative(configFolder, each));
    const compileds: string[] = [];
    visitCompile(tsconfig!, {
      transpile: true,
      files,
      getSourceFilePath: (filepath: string) => `${configFolder}/${filepath}`,
      visitors: [
        (node, sourcefile) => {
          // 涉及到输出位置调整，需要重新解析imports的相对路径
          node = transformImportsPath(node, configFolder, outputFolder);
          // 直接默认导出函数声明的情况
          if (ts.isFunctionDeclaration(node) && (<ts.FunctionDeclaration>node).modifiers) {
            const modifiers = (<ts.FunctionDeclaration>node).modifiers!;
            const isExport = modifiers.findIndex(i => i.kind === ts.SyntaxKind.ExportKeyword) >= 0;
            const isDefault = modifiers.findIndex(i => i.kind === ts.SyntaxKind.DefaultKeyword) >= 0;
            if (isExport && isDefault) {
              const source = <ts.FunctionDeclaration>node;
              return ts.createExportAssignment(
                [],
                [],
                true,
                wrapAutoRunFunction(
                  ts.createFunctionExpression(
                    [],
                    source.asteriskToken,
                    source.name,
                    source.typeParameters,
                    source.parameters,
                    source.type,
                    source.body!
                  )
                )
              );
            }
          }
          // 默认导出变量声明的情况
          if (ts.isExportAssignment(node)) {
            const expression = (<ts.ExportAssignment>node).expression;
            if (ts.isIdentifier(expression)) {
              const found = sourcefile.statements.find(
                i => ts.isFunctionDeclaration(i) && !!i.name && i.name.text === expression.text
              );
              return ts.createExportAssignment([], [], true, !found ? expression : ts.createCall(expression, [], []));
            }
            if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
              return ts.createExportAssignment([], [], true, wrapAutoRunFunction(expression));
            }
          }
          // 其余情况不支持编译，不做改变
          return node;
        }
      ],
      emit: (compiled, content) => {
        const relaPath = path.relative(configFolder, compiled);
        const compiledPath = path.resolve(outputFolder, relaPath.replace(/\.ts$/, ".js"));
        if (!!force || !fs.existsSync(compiledPath) || useHMR) {
          fs.appendFileSync(compiledPath, content, { flag: "w" });
          return compileds.push(compiledPath);
        }
        const oldFile = fs.readFileSync(compiledPath, { flag: "r" });
        if (oldFile.toString() !== content) {
          fs.appendFileSync(compiledPath, content, { flag: "w" });
          compileds.push(compiledPath);
        } else {
          return;
        }
      }
    });
    return compileds;
  } catch (error) {
    throw error;
  }
}

function initCompilePreSteps(configFolder: string, force: boolean, outputFolder: string) {
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
