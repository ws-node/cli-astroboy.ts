import ts from "typescript";
import { createProgram, loadProgramConfig } from "../utils/type-check";

export interface IVisitor {
  (node: ts.Node, sourcefile: ts.SourceFile, data: any): ts.Node | ts.Node[];
}

export interface IVisitCompileContext {
  transpile: boolean;
  files: string[];
  visitors: IVisitor[];
  getSourceFilePath(filepath: string): string;
  emit(filepath: string, content: string): void;
}

export function visitCompile(tsconfig: string, context: IVisitCompileContext) {
  const { transpile = false, files, visitors, emit, getSourceFilePath } = context;
  const app = createProgram(
    loadProgramConfig(tsconfig!, {
      noEmit: true,
      skipLibCheck: true
    })
  );
  const printer = ts.createPrinter({
    removeComments: false,
    newLine: ts.NewLineKind.LineFeed,
    omitTrailingSemicolon: true,
    noEmitHelpers: false
  });
  const metadata: any = {};
  const result = ts.transform(
    files.map(filepath => app.getSourceFile(getSourceFilePath(filepath))!),
    visitors.map(visitor => ctx => node =>
      ts.visitEachChild(node, n => visitor(n, node, metadata[node.fileName] || (metadata[node.fileName] = {})), ctx)
    )
  );
  result.transformed.forEach(compiled => {
    const fileStr = !transpile
      ? printer.printFile(compiled)
      : ts.transpile(printer.printFile(compiled), app.getCompilerOptions());
    emit(compiled.fileName, fileStr);
  });
}

export { ts };
