import ts from "typescript";
import path from "path";

export enum ImportStyle {
  TSLib = 0,
  Namespace = 1,
  Named = 2,
  Star = 3,
  Module = 4
}

export interface IFuncParam {
  name: string;
  type: "directType" | "namespaceType" | "[unknown type]";
  namespace?: string;
  typeName: string;
  paramIndex: number;
}

export interface ICompileContext {
  main: {
    root: string;
    out: string;
  };
  imports: {
    [name: string]: {
      type: ImportStyle;
      reference: string;
      name: string[];
      identity: string;
    };
  };
  functions: {
    [name: string]: {
      name: string;
      params: Array<IFuncParam>;
    };
  };
  exports: {
    [name: string]: {
      name: string;
    };
  };
}

export function compileForEach(node: ts.Node, context: ICompileContext): void {
  switch (node.kind) {
    case ts.SyntaxKind.ImportEqualsDeclaration:
    case ts.SyntaxKind.ImportDeclaration:
      resolveImports(context, node);
      break;
    case ts.SyntaxKind.FunctionDeclaration:
      resolveFunctions(context, node);
      break;
    case ts.SyntaxKind.ExportAssignment:
    case ts.SyntaxKind.ExportDeclaration:
      resolveExports(context, node);
      break;
    case ts.SyntaxKind.EndOfFileToken:
    case ts.SyntaxKind.SourceFile:
    default:
      ts.forEachChild(node, node => compileForEach(node, context));
  }
}

function resolveExports(context: ICompileContext, node: ts.Node) {
  const exports = (context["exports"] = context["exports"] || {});
  const thisExportsNode = <ts.ExpressionWithTypeArguments>node;
  const dLen = Object.keys(exports).filter(i =>
    i.startsWith("[dynamic exports")
  ).length;
  const name =
    (<any>thisExportsNode.expression)["text"] || `[dynamic exports ${dLen}]`;
  exports[name] = { name };
}

function resolveFunctions(context: ICompileContext, node: ts.Node) {
  const functions = (context["functions"] = context["functions"] || {});
  const thisFuncNode = <ts.FunctionDeclaration>node;
  const isExports = (<any[]>(thisFuncNode["modifiers"] || []))
    .map((i: ts.Modifier) => i.kind)
    .includes(ts.SyntaxKind.ExportKeyword);
  const dLen = Object.keys(functions).filter(i =>
    i.startsWith("[dynamic function")
  ).length;
  const name = !thisFuncNode.name
    ? `[dynamic function ${dLen + 1}]`
    : thisFuncNode.name.text;
  if (isExports) {
    const exports = (context["exports"] = context["exports"] || {});
    exports[name] = { name };
  }
  const thisFunc: { name: string; params: IFuncParam[] } = (functions[name] = {
    name,
    params: []
  });
  (<any>thisFuncNode.parameters || []).forEach(
    (param: ts.ParameterDeclaration, index: number) => {
      if (!param.type || !(<any>param.type)["typeName"]) {
        return thisFunc.params.push({
          name: (<ts.Identifier>param.name).text,
          type: "[unknown type]",
          namespace: "[unknown namespace]",
          typeName: "[unknown typeName]",
          paramIndex: index
        });
      }
      if ((<any>param.type)["typeName"].kind === ts.SyntaxKind.QualifiedName) {
        thisFunc.params.push({
          name: (<ts.Identifier>param.name).text,
          type: "namespaceType",
          namespace: (<any>param.type)["typeName"].left.text,
          typeName: (<any>param.type)["typeName"].right.text,
          paramIndex: index
        });
      } else {
        thisFunc.params.push({
          name: (<ts.Identifier>param.name).text,
          type: "directType",
          typeName: (<any>param.type)["typeName"].text,
          paramIndex: index
        });
      }
    }
  );
}

function resolveImports(context: ICompileContext, node: ts.Node) {
  const imports = (context["imports"] = context["imports"] || {});
  if (Object.keys(imports).length === 0) {
    imports["tslib_1"] = {
      type: ImportStyle.TSLib,
      name: ["tslib"],
      identity: "tslib_1",
      reference: "tslib"
    };
  }
  if (node.kind === ts.SyntaxKind.ImportEqualsDeclaration) {
    const thisNode = <ts.ImportEqualsDeclaration>node;
    const reference =
      (<any>(<ts.ExternalModuleReference>thisNode.moduleReference).expression)[
        "text"
      ] || "";
    const identity = getIdentity(reference, context);
    imports[identity] = {
      type: ImportStyle.Module,
      name: [thisNode.name.text],
      identity,
      reference
    };
  } else {
    const thisNode = <ts.ImportDeclaration>node;
    const namedBindings = thisNode.importClause!.namedBindings!;
    if (namedBindings) {
      if (!(<ts.NamedImports>namedBindings).elements) {
        const current = <ts.NamespaceImport>namedBindings;
        const reference = (<any>thisNode.moduleSpecifier)["text"] || "";
        const identity = getIdentity(reference, context);
        imports[identity] = {
          type: ImportStyle.Star,
          name: [current.name.text],
          identity,
          reference
        };
      } else {
        const reference = (<any>thisNode.moduleSpecifier)["text"] || "";
        const identity = getIdentity(reference, context);
        imports[identity] = {
          type: ImportStyle.Named,
          name: [],
          identity,
          reference
        };
        (<ts.NamedImports>namedBindings).elements.forEach(each => {
          imports[identity].name.push(each.name.text);
        });
      }
    } else {
      const current = thisNode.importClause!;
      const reference = (<any>thisNode.moduleSpecifier)["text"] || "";
      const identity = getIdentity(reference, context);
      imports[identity] = {
        type: ImportStyle.Namespace,
        name: [current.name!.text],
        identity,
        reference
      };
    }
  }
}

function getIdentity(reference: string, context: ICompileContext) {
  const idx = (reference || "").lastIndexOf("/");
  const lastTail = (reference || "").slice(idx + 1) || "";
  const temp_id = normalize(lastTail);
  const count = Object.keys(context.imports).filter(i => i.startsWith(temp_id))
    .length;
  return `${temp_id}_${count + 1}`;
}

function normalize(value: string) {
  return value.replace(/\./g, "_").replace(/\-/g, "_");
}

function resolveRelativePath(reference: string, context: ICompileContext) {
  if (!reference || !reference.startsWith(".")) return [false, reference];
  const { root: sourceRoot, out: output } = context.main;
  const abosolute = path.resolve(sourceRoot, reference);
  return [true, path.relative(output, abosolute)];
}

export const ImportsHelper = {
  toJsList(context: ICompileContext) {
    return Object.keys(context.imports)
      .map<[ImportStyle, string]>(id => {
        const current = context.imports[id];
        const [is, relativePath] = resolveRelativePath(
          current.reference,
          context
        );
        let result: string;
        switch (current.type) {
          case ImportStyle.TSLib:
            result = `const ${current.identity} = require("${relativePath}");`;
            break;
          case ImportStyle.Module:
            result = `const ${current.identity} = require("${relativePath}");`;
            break;
          case ImportStyle.Named:
            result = `const ${current.identity} = require("${relativePath}");`;
            break;
          case ImportStyle.Namespace:
            result = `const ${
              current.identity
            } = tslib_1.__importDefault(require("${relativePath}"));`;
            break;
          case ImportStyle.Star:
            result = `const ${
              current.identity
            } = tslib_1.__importStar(require("${relativePath}"));`;
            break;
          default:
            result = "";
        }
        return [is ? 6 : current.type, result];
      })
      .sort((a, b) => a[0] - b[0]);
  },

  toTsList(context: ICompileContext) {
    return Object.keys(context.imports)
      .filter(n => n !== "tslib_1")
      .map<[ImportStyle, string]>(id => {
        const current = context.imports[id];
        const [is, relativePath] = resolveRelativePath(
          current.reference,
          context
        );
        let result: string;
        switch (current.type) {
          case ImportStyle.TSLib:
            result = `const ${current.identity} = require("${relativePath}");`;
            break;
          case ImportStyle.Module:
            result = `import ${current.identity} = require("${relativePath}");`;
            break;
          case ImportStyle.Named:
            result = `import ${current.identity} = require("${relativePath}");`;
            break;
          case ImportStyle.Namespace:
            result = `import ${current.identity} from "${relativePath}";`;
            break;
          case ImportStyle.Star:
            result = `import * as ${current.identity} from "${relativePath}";`;
            break;
          default:
            result = "";
        }
        return [is ? 6 : current.type, result];
      })
      .sort((a, b) => a[0] - b[0]);
  },

  toList(context: ICompileContext, type: "ts" | "js") {
    if (type === "ts") {
      return ImportsHelper.toTsList(context).map(([, result]) => result);
    }
    return ImportsHelper.toJsList(context).map(([, result]) => result);
  }
};
