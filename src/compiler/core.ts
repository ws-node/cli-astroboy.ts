import ts from "typescript";
import { createProgram, loadProgramConfig } from "../utils/type-check";

export interface IVisitCompileContext {
  files: string[];
  getSourceFilePath(filepath: string): string;
  visitor(node: ts.Node): ts.Node;
  emit(filepath: string, content: string): void;
}

export function visitCompile(tsconfig: string, context: IVisitCompileContext) {
  const { files, visitor, emit, getSourceFilePath } = context;
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
  const result = ts.transform(
    files.map(filepath => {
      const sourcePath = getSourceFilePath(filepath);
      return app.getSourceFile(sourcePath)!;
    }),
    [ctx => node => ts.visitEachChild(node, visitor, ctx)]
  );
  result.transformed.forEach(compiled => {
    const fileStr = ts.transpile(printer.printFile(compiled), app.getCompilerOptions());
    emit(compiled.fileName, fileStr);
  });
}

export { ts };
