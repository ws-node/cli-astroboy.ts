import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import { ts, visitCompile } from "../compiler/core";
import {
  createCommonWrapperExportFunction,
  createDIWrapperExportFunction,
  transformImportsPath
} from "../compiler/statements";

// tslint:disable: no-console

interface ITransformSharedData {
  coreImportStyle?: "import-require" | "import-from";
  hasCoreModule?: boolean;
  coreImportCreated?: boolean;
  useDI?: boolean;
}

export interface IMiddlewareCompilerOptions {
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

export interface IInnerMiddlewareCompilerOptions extends IMiddlewareCompilerOptions {
  fileList?: string[];
}

export const defaultConfigCompilerOptions: IMiddlewareCompilerOptions = {
  enabled: false,
  force: false,
  tsconfig: undefined,
  rootFolder: "middlewares",
  outFolder: "app/middlewares"
};

const CORE_MODULE = "@exoskeleton/core";
const INJECT_SCOPE = "injectScope";
const INTERF_SCOPE = "IMiddlewaresScope";

export function middlewareCompileFn(options: Partial<IInnerMiddlewareCompilerOptions>): string[] {
  const { enabled = false, force = false, rootFolder, outFolder, tsconfig, fileList = [] } = options;
  if (!enabled) return [];
  try {
    const cwd = process.cwd();
    const middleRootFolder = path.resolve(cwd, rootFolder || defaultConfigCompilerOptions.rootFolder!);
    const outputFolder = path.resolve(cwd, outFolder || defaultConfigCompilerOptions.outFolder!);
    const EXTENSIONS = !!force ? ".ts" : ".js";
    if (!fs.existsSync(middleRootFolder)) fs.mkdirSync(middleRootFolder, { recursive: true });
    const watchedFiles = fileList.filter(findTsFiles);
    const useHMR = watchedFiles.length > 0;
    console.log(`root  ==> "${chalk.green(rootFolder!)}"`);
    console.log(`force ==> ${chalk.magenta(String(!!force))}`);
    console.log(`incre ==> ${chalk.magenta(String(!!useHMR))}`);
    console.log("");
    if (useHMR) {
      const valid = watchedFiles.every(p => p.startsWith(middleRootFolder));
      if (!valid) {
        throw new Error("Middleware-Compiler Error: paths of increment changed files must startsWith rootFolder.");
      }
    }
    const files = !useHMR
      ? initCompilePreSteps(middleRootFolder, force, outputFolder, EXTENSIONS)
      : watchedFiles.map(each => path.relative(rootFolder!, each));
    const compileds: string[] = [];
    visitCompile(tsconfig!, {
      transpile: !force,
      files,
      getSourceFilePath: filepath => `${middleRootFolder}/${filepath}`,
      visitors: [
        node => {
          // 涉及到输出位置调整，需要重新解析imports的相对路径
          node = transformImportsPath(node, middleRootFolder, outputFolder);
          if (ts.isFunctionDeclaration(node) && (<ts.FunctionDeclaration>node).modifiers) {
            const modifiers = (<ts.FunctionDeclaration>node).modifiers!;
            const isExport = modifiers.findIndex(i => i.kind === ts.SyntaxKind.ExportKeyword) >= 0;
            const isDefault = modifiers.findIndex(i => i.kind === ts.SyntaxKind.DefaultKeyword) >= 0;
            if (isExport && isDefault) {
              // 去掉导出标识，为下一轮转换作准备
              const source = <ts.FunctionDeclaration>node;
              return [
                ts.updateFunctionDeclaration(
                  source,
                  source.decorators,
                  modifiers.filter(
                    i => i.kind !== ts.SyntaxKind.ExportKeyword && i.kind !== ts.SyntaxKind.DefaultKeyword
                  ),
                  source.asteriskToken,
                  source.name,
                  source.typeParameters,
                  source.parameters,
                  source.type,
                  source.body
                ),
                ts.createExportAssignment([], [], true, source.name!)
              ];
            }
          }
          return node;
        },
        (node, _, data: ITransformSharedData) => {
          // 检查@exo/core是否导入，完成导入项补偿
          if (data.hasCoreModule) return node;
          if (ts.isImportDeclaration(node)) {
            if (ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === CORE_MODULE) {
              data.coreImportStyle = "import-from";
              data.hasCoreModule = true;
              if (
                node.importClause &&
                !!node.importClause.namedBindings &&
                ts.isNamedImports(node.importClause.namedBindings)
              ) {
                const named = node.importClause.namedBindings;
                const namedEles = [...named.elements];
                if (named.elements.findIndex(a => a.name.text === INTERF_SCOPE) < 0) {
                  namedEles.push(ts.createImportSpecifier(undefined, ts.createIdentifier(INTERF_SCOPE)));
                }
                if (named.elements.findIndex(a => a.name.text === INJECT_SCOPE) < 0) {
                  namedEles.push(ts.createImportSpecifier(undefined, ts.createIdentifier(INJECT_SCOPE)));
                }
                return ts.updateImportDeclaration(
                  node,
                  [],
                  [],
                  ts.updateImportClause(node.importClause, undefined, ts.createNamedImports(namedEles), node.importClause.isTypeOnly),
                  node.moduleSpecifier
                );
              } else {
                return node;
              }
            }
          }
          if (ts.isImportEqualsDeclaration(node)) {
            if (
              ts.isExternalModuleReference(node.moduleReference) &&
              ts.isStringLiteral(node.moduleReference.expression) &&
              node.moduleReference.expression.text === CORE_MODULE
            ) {
              data.coreImportStyle = "import-require";
              data.hasCoreModule = true;
            }
          }
          return node;
        },
        (node, sourcefile, data: ITransformSharedData) => {
          const index = sourcefile.statements.findIndex(i => i.kind === node.kind);
          // 补充倒入@exo/core
          if (index === 0 && !data.coreImportStyle && !data.coreImportCreated) {
            data.coreImportCreated = true;
            return [
              ts.createImportDeclaration(
                [],
                [],
                ts.createImportClause(
                  undefined,
                  ts.createNamedImports([
                    ts.createImportSpecifier(undefined, ts.createIdentifier(INJECT_SCOPE)),
                    ts.createImportSpecifier(undefined, ts.createIdentifier(INTERF_SCOPE))
                  ])
                ),
                ts.createStringLiteral(CORE_MODULE)
              ),
              node
            ];
          }
          return node;
        },
        (node, sourcefile, data: ITransformSharedData) => {
          // 完成DI绑定
          if (ts.isExportAssignment(node)) {
            const expression = (<ts.ExportAssignment>node).expression;
            if (ts.isIdentifier(expression)) {
              const exportName = (<ts.Identifier>expression).text;
              const target: ts.FunctionDeclaration | ts.VariableDeclaration | undefined = <any>(
                sourcefile.statements.find(
                  (i: any) =>
                    // 默认导出的为函数或者变量
                    (ts.isFunctionDeclaration(i) || ts.isVariableDeclaration(i)) &&
                    // 必须是匹配对应名称的声明
                    (!!i["name"] && ts.isIdentifier(i.name) && i.name.text === exportName)
                )
              );
              if (target) {
                let useDI = true;
                let coreNamed = true;
                let coreSpc: string = undefined!;
                let funcDepts: any[] = [];
                if (ts.isFunctionDeclaration(target)) {
                  const func = <ts.FunctionDeclaration>target;
                  const types = func.parameters
                    // 排除this类型标示
                    .filter(i => ts.isIdentifier(i.name) && i.name.text !== "this")
                    .map(i => i.type || ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword));
                  if (func.parameters.length === 1) {
                    const param = func.parameters[0];
                    if (
                      !param.type ||
                      param.type.kind === ts.SyntaxKind.AnyKeyword ||
                      ts.isTypeLiteralNode(param.type)
                    ) {
                      useDI = false;
                    }
                  }
                  if (types.every(i => i.kind === ts.SyntaxKind.TypeReference)) {
                    funcDepts = (types as any[])
                      .map((i: ts.TypeReferenceNode) => i.typeName)
                      .map((i: ts.QualifiedName | ts.Identifier) =>
                        ts.isIdentifier(i)
                          ? i
                          : ts.createPropertyAccess(
                              ts.isIdentifier(i.left) ? i.left : ts.createIdentifier("???"),
                              i.right
                            )
                      );
                  }
                } else {
                  return node;
                  // const vari = <ts.VariableDeclaration>target;
                  // 暂时不支持 arrow function，写死老子了
                }
                if (useDI) {
                  data.useDI = true;
                  const statements = [...sourcefile.statements];
                  const coreIndex = sourcefile.statements
                    .filter((i: any) => ts.isImportDeclaration(i) || ts.isImportEqualsDeclaration(i))
                    .findIndex(i => {
                      if (ts.isImportDeclaration(i) && ts.isStringLiteral((<ts.ImportDeclaration>i).moduleSpecifier)) {
                        return (<ts.StringLiteral>i.moduleSpecifier).text === CORE_MODULE;
                      } else if (
                        ts.isImportEqualsDeclaration(i) &&
                        ts.isExternalModuleReference((<ts.ImportEqualsDeclaration>i).moduleReference) &&
                        ts.isStringLiteral(
                          (<ts.ExternalModuleReference>(<ts.ImportEqualsDeclaration>i).moduleReference).expression
                        )
                      ) {
                        return (
                          (<ts.StringLiteral>(
                            (<ts.ExternalModuleReference>(<ts.ImportEqualsDeclaration>i).moduleReference).expression
                          )).text === CORE_MODULE
                        );
                      } else {
                        return false;
                      }
                    });
                  const core: ts.ImportDeclaration | ts.ImportEqualsDeclaration = <any>statements[coreIndex];
                  if (ts.isImportDeclaration(core) && !!core.importClause && !!core.importClause.namedBindings) {
                    const host = core.importClause.namedBindings;
                    if (ts.isNamespaceImport(host)) {
                      coreNamed = false;
                      coreSpc = host.name.text;
                    }
                  } else if (ts.isImportEqualsDeclaration(core)) {
                    coreNamed = false;
                    coreSpc = core.name.text;
                  }
                }
                return !useDI
                  ? createCommonWrapperExportFunction(exportName)
                  : createDIWrapperExportFunction(
                      exportName,
                      coreNamed
                        ? ts.createIdentifier(INJECT_SCOPE)
                        : ts.createPropertyAccess(ts.createIdentifier(coreSpc), ts.createIdentifier(INJECT_SCOPE)),
                      funcDepts
                    );
              }
            }
          }
          return node;
        }
      ],
      emit: (compiled, content) => {
        const relaPath = path.relative(middleRootFolder, compiled);
        const compiledPath = path.resolve(outputFolder, relaPath.replace(/\.ts$/, EXTENSIONS));
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
    console.log(chalk.red(error.message || ""));
    throw error;
  }
}

function initCompilePreSteps(middleRootFolder: string, force: boolean, outputFolder: string, EXTENSIONS: string) {
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
    fs.mkdirSync(outputFolder, { recursive: true });
  }
  return files.filter(findTsFiles);
}

function findTsFiles(i: string): any {
  return i.endsWith(".ts") && !i.endsWith(".d.ts");
}
