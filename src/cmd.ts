import {
  CmdConfig,
  createCmdConfig,
  mergeCmdConfig,
  RouterConfig as RConfig,
  IENV as E
} from "./base";
import { initRouters } from "./builders/routers";
import { compileFn, ConfigCompilerOptions } from "./builders/config-compiler";
import {
  MiddlewareCompilerOptions,
  middlewareCompileFn
} from "./builders/middleware-cmp";

interface IPreProcess {
  /** 是否自动生成2.0的routers，默认：`false` */
  enabled: boolean;
  /** 是否强制刷新2.0的routers，默认：`false` */
  always: boolean;
  /** 整个项目的url前缀，默认：`'/'` */
  appRoot: string;
  /** 生成router文件的文件类型，默认：`'js'` */
  fileType: "js" | "ts";
}

/**
 * ## astroboy.ts 预处理函数
 * * 硬核初始化routers
 * @description
 * @author Big Mogician
 * @export
 * @param {Partial<IPreProcess>} {
 *   routerAutoBuild: open = defaultEnv.routerAutoBuild,
 *   routerAlwaysBuild: always = defaultEnv.routerAlwaysBuild,
 *   routerRoot: root = defaultEnv.routerRoot
 * }
 */
export function preInitFn(configs: Partial<IPreProcess>): void;
export function preInitFn(configs: Partial<IPreProcess>, inEnd?: any) {
  return initRouters(configs, inEnd);
}

/**
 * ## astroboy.ts 配置文件预处理函数
 * * 硬核初始化config
 * @author Big Mogician
 * @export
 * @param {Partial<ConfigCompilerOptions>} configs
 */
export function preConfigCompiler(configs: Partial<ConfigCompilerOptions>) {
  return compileFn(configs);
}

/**
 * ## astroboy.ts 中间件预处理函数
 * * 硬核初始化middleware
 * @author Big Mogician
 * @export
 * @param {Partial<MiddlewareCompilerOptions>} configs
 */
export function preMiddlewareCompiler(
  configs: Partial<MiddlewareCompilerOptions>
) {
  return middlewareCompileFn(configs);
}

export interface Env extends E {}
export interface RouterConfig extends RConfig {}
export interface Config extends CmdConfig {
  env?: Env;
  routers?: RouterConfig;
}

export function create(config: Config) {
  return createCmdConfig(config);
}

export function merge(merge: Config, config: Config) {
  return mergeCmdConfig(merge, config);
}
