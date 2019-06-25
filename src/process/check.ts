import { CancellationToken as CT } from "../utils/cancellation-token";
import { NormalizedMessage, Severity } from "../utils/normalized-msg";
import { loadProgramConfig, createProgram } from "../utils/type-check";
import * as ts from "typescript";

const { TSCONFIG } = process.env;

async function run(ct: CT) {
  let diagnostics: any[] = [];
  const options = loadProgramConfig(TSCONFIG!, { noEmit: true });
  const program = createProgram(options);

  try {
    ct.throwIfCancellationRequested();
    diagnostics = await validation(program, ct);
  } catch (error) {
    if (error instanceof ts.OperationCanceledException) {
      return;
    }
    throw error;
  }

  if (!ct.isCancellationRequested()) {
    try {
      process.send!({
        diagnostics
      });
    } catch (e) {
      process.exit();
    }
  }
}

async function validation(program: ts.Program, cancellationToken: CT) {
  const diagnostics: any[] = [];
  const sourceFiles = program.getSourceFiles();
  sourceFiles.forEach(sourceFile => {
    const register = program
      .getSemanticDiagnostics(sourceFile, cancellationToken)
      .concat(program.getSyntacticDiagnostics(sourceFile, cancellationToken));
    diagnostics.push(
      ...register.map(
        i =>
          new NormalizedMessage({
            type: NormalizedMessage.TYPE_DIAGNOSTIC,
            code: i.code,
            severity: ts.DiagnosticCategory[
              i.category
            ].toLowerCase() as Severity,
            content: ts.flattenDiagnosticMessageText(i.messageText, "\n"),
            file: i.file!.fileName,
            line: i.file!.getLineAndCharacterOfPosition(i.start || 0).line + 1,
            character:
              i.file!.getLineAndCharacterOfPosition(i.start || 0).character + 1
          })
      )
    );
  });
  return Promise.resolve(diagnostics);
}

process.on("message", message => {
  run(CT.createFromJSON(ts, message));
});

process.on("SIGINT", () => {
  process.exit();
});
