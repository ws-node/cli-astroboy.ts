import get from "lodash/get";
import { ChildProcess } from "child_process";

export interface IntergradeOptions<C> {
  changes?: string[];
  type?: "spawn" | "fork" | "exec";
  token?: C;
  defineCancel?: (child: ChildProcess, token: C) => void;
}

export interface CommandPlugin {
  name: string;
  description: string;
  options: Array<[string, string]>;
  action: (...args: any[]) => void;
  help: (...args: any[]) => void;
}

export interface IENV {
  NODE_ENV?: string;
  NODE_PORT?: number | string;
  [key: string]: any;
}

export interface RouterConfig {
  enabled?: boolean;
  always?: boolean;
  approot?: string;
  filetype?: "js" | "ts";
  details?: boolean;
  tsconfig?: string;
}

export interface ConfigCompilerCmdConfig {
  enabled?: boolean;
  force?: boolean;
  configroot?: string;
  outputroot?: string;
  tsconfig?: string;
}

export interface MiddlewareCompilerCmdConfig {
  enabled?: boolean;
  force?: boolean;
  root?: string;
  output?: string;
  tsconfig?: string;
}

export interface CmdConfig {
  tsconfig?: string;
  inspect?: boolean;
  env?: IENV;
  watch?: string[] | false;
  ignore?: string[] | false;
  verbose?: boolean;
  debug?: boolean | string;
  mock?: boolean | string;
  typeCheck?: boolean;
  transpile?: boolean;
  routers?: RouterConfig;
  compile?: boolean;
  configCompiler?: ConfigCompilerCmdConfig & { hmr?: boolean };
  middlewareCompiler?: MiddlewareCompilerCmdConfig & { hmr?: boolean };
}

export interface InnerCmdConfig extends CmdConfig {
  env?: IENV & { __TSCONFIG?: any; __TRANSPILE?: any };
  exec?: string;
}

export function createCmdConfig(config: CmdConfig): CmdConfig {
  return config;
}

export function mergeCmdConfig(config: CmdConfig, merge: CmdConfig): CmdConfig {
  const watch = get(merge, "watch", undefined);
  const ignore = get(merge, "ignore", undefined);
  const oldEnvs = get(merge, "env", {});
  const newEnvs = get(merge, "env", {});
  return {
    tsconfig: get(merge, "tsconfig", config.tsconfig),
    inspect: get(merge, "inspect", config.inspect),
    env: {
      ...oldEnvs,
      ...newEnvs
    },
    watch: !watch
      ? config.watch
      : config.watch !== false
      ? [...(config.watch || []), ...watch]
      : [],
    ignore: !ignore
      ? config.ignore
      : config.ignore !== false
      ? [...(config.ignore || []), ...ignore]
      : [],
    verbose: get(merge, "verbose", config.verbose),
    debug: get(merge, "debug", config.debug),
    mock: get(merge, "mock", config.mock),
    typeCheck: get(merge, "typeCheck", config.typeCheck),
    transpile: get(merge, "transpile", config.transpile),
    compile: get(merge, "compile", config.compile),
    routers: {
      ...get(config, "routers", {}),
      ...get(merge, "routers", {})
    },
    configCompiler: {
      ...get(config, "configCompiler", {}),
      ...get(merge, "configCompiler", {})
    },
    middlewareCompiler: {
      ...get(config, "middlewareCompiler", {}),
      ...get(merge, "middlewareCompiler", {})
    }
  };
}
