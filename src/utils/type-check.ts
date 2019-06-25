import path from "path";
import { Configuration } from "tslint";
import * as ts from "typescript";

export function loadProgramConfig(configFile: string, compilerOptions: ts.CompilerOptions) {
  const tsconfig = ts.readConfigFile(configFile, ts.sys.readFile).config;

  tsconfig.compilerOptions = tsconfig.compilerOptions || {};
  tsconfig.compilerOptions = {
    ...tsconfig.compilerOptions,
    ...compilerOptions
  };

  const parsed = ts.parseJsonConfigFileContent(tsconfig, ts.sys, path.dirname(configFile));

  return parsed;
}

interface IConfigurationFile extends Configuration.IConfigurationFile {
  linterOptions?: {
    typeCheck?: boolean;
    exclude?: string[];
  };
}

export function loadLinterConfig(configFile: string): IConfigurationFile {
  // tslint:disable-next-line:no-implicit-dependencies
  const tslint = require("tslint");

  return tslint.Configuration.loadConfigurationFromPath(configFile) as IConfigurationFile;
}

export function createProgram(programConfig: ts.ParsedCommandLine, oldProgram?: ts.Program) {
  const host = ts.createCompilerHost(programConfig.options);
  return ts.createProgram(
    programConfig.fileNames,
    programConfig.options,
    host,
    oldProgram // re-use old program
  );
}
