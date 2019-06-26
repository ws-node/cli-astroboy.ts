import path from "path";
import ts from "typescript";

function resolveRelativePath(reference: string, sourceRoot: string, outputRoot: string) {
  const abosolute = path.resolve(sourceRoot, reference);
  return path.relative(outputRoot, abosolute);
}

export function transformImportsPath(node: ts.Node, sourceRoot: string, outputRoot: string) {
  // import ... from "./xxxxxx"
  if (ts.isImportDeclaration(node)) {
    const specifier = (<ts.ImportDeclaration>node).moduleSpecifier;
    if (ts.isStringLiteral(specifier)) {
      const moduleName = (<ts.StringLiteral>specifier).text;
      if (moduleName.startsWith(".")) {
        const realModuleRef = resolveRelativePath(moduleName, sourceRoot, outputRoot);
        return ts.updateImportDeclaration(
          node,
          node.decorators,
          node.modifiers,
          node.importClause,
          ts.createStringLiteral(realModuleRef)
        );
      }
    }
  }
  // import ... = require("./xxxxxx")
  if (ts.isImportEqualsDeclaration(node)) {
    const reference = (<ts.ImportEqualsDeclaration>node).moduleReference;
    if (ts.isExternalModuleReference(reference)) {
      const exp = (<ts.ExternalModuleReference>reference).expression;
      if (ts.isStringLiteral(exp)) {
        const moduleName = (<ts.StringLiteral>exp).text;
        if (moduleName.startsWith(".")) {
          const realModuleRef = resolveRelativePath(moduleName, sourceRoot, outputRoot);
          return ts.updateImportEqualsDeclaration(
            node,
            node.decorators,
            node.modifiers,
            node.name,
            ts.createExternalModuleReference(ts.createStringLiteral(realModuleRef))
          );
        }
      }
    }
  }
  return node;
}

export function createDIWrapperExportFunction(
  exportName: string,
  callFunc: ts.PropertyAccessExpression | ts.Identifier,
  depts: Array<ts.PropertyAccessExpression | ts.Identifier>
): ts.Node | ts.Node[] {
  return ts.createExportAssignment(
    [],
    [],
    true,
    ts.createArrowFunction(
      [],
      [],
      [
        ts.createParameter(
          [],
          [],
          undefined,
          ts.createIdentifier("options"),
          undefined,
          ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
          ts.createObjectLiteral()
        ),
        ts.createParameter(
          [],
          [],
          undefined,
          ts.createIdentifier("app"),
          undefined,
          ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
          undefined
        )
      ],
      undefined,
      ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
      ts.createCall(
        callFunc,
        [],
        [
          ts.createArrowFunction(
            [ts.createToken(ts.SyntaxKind.AsyncKeyword)],
            [],
            [
              ts.createParameter(
                [],
                [],
                undefined,
                ts.createObjectBindingPattern([
                  ts.createBindingElement(undefined, undefined, ts.createIdentifier("injector")),
                  ts.createBindingElement(undefined, undefined, ts.createIdentifier("next"))
                ]),
                undefined,
                ts.createTypeReferenceNode(ts.createIdentifier("IMiddlewaresScope"), [])
              )
            ],
            undefined,
            ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
            ts.createBlock(
              (depts.map((dept, index) =>
                ts.createVariableStatement(
                  [],
                  ts.createVariableDeclarationList(
                    [
                      ts.createVariableDeclaration(
                        ts.createIdentifier(`_p${index}`),
                        undefined,
                        ts.createCall(
                          ts.createPropertyAccess(ts.createIdentifier("injector"), ts.createIdentifier("get")),
                          undefined,
                          [dept]
                        )
                      )
                    ],
                    ts.NodeFlags.Const
                  )
                )
              ) as any[]).concat(
                ts.createExpressionStatement(
                  ts.createAwait(
                    ts.createCall(
                      ts.createPropertyAccess(ts.createIdentifier(exportName), ts.createIdentifier("call")),
                      undefined,
                      ([
                        ts.createObjectLiteral([
                          ts.createShorthandPropertyAssignment(ts.createIdentifier("next")),
                          ts.createShorthandPropertyAssignment(ts.createIdentifier("options")),
                          ts.createShorthandPropertyAssignment(ts.createIdentifier("app"))
                        ])
                      ] as any[]).concat(...depts.map((_, index) => ts.createIdentifier(`_p${index}`)))
                    )
                  )
                )
              ),
              true
            )
          )
        ]
      )
    )
  );
}

export function createCommonWrapperExportFunction(exportName: string): ts.Node | ts.Node[] {
  return ts.createExportAssignment(
    [],
    [],
    true,
    ts.createArrowFunction(
      [],
      [],
      [
        ts.createParameter(
          [],
          [],
          undefined,
          ts.createIdentifier("options"),
          undefined,
          ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
          ts.createObjectLiteral()
        ),
        ts.createParameter(
          [],
          [],
          undefined,
          ts.createIdentifier("app"),
          undefined,
          ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
          undefined
        )
      ],
      undefined,
      ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
      ts.createArrowFunction(
        [ts.createToken(ts.SyntaxKind.AsyncKeyword)],
        [],
        [
          ts.createParameter(
            [],
            [],
            undefined,
            ts.createIdentifier("ctx"),
            undefined,
            ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
            undefined
          ),
          ts.createParameter(
            [],
            [],
            undefined,
            ts.createIdentifier("next"),
            undefined,
            ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
            undefined
          )
        ],
        undefined,
        ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
        ts.createBlock(
          [
            ts.createReturn(
              ts.createAwait(
                ts.createCall(
                  ts.createIdentifier(exportName),
                  [],
                  [
                    ts.createAsExpression(
                      ts.createObjectLiteral(
                        [
                          ts.createShorthandPropertyAssignment("ctx"),
                          ts.createShorthandPropertyAssignment("options"),
                          ts.createShorthandPropertyAssignment("app"),
                          ts.createShorthandPropertyAssignment("next")
                        ],
                        false
                      ),
                      ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)
                    )
                  ]
                )
              )
            )
          ],
          true
        )
      )
    )
  );
}
