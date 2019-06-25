import { CmdConfig, createCmdConfig, IENV as E, mergeCmdConfig, RouterConfig as RConfig } from "./base";
import { compileFn, IConfigCompilerOptions } from "./builders/config-compiler";
import { IMiddlewareCompilerOptions, middlewareCompileFn } from "./builders/middleware-cmp";
import { initRouters } from "./builders/routers";

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
 * @param {Partial<IConfigCompilerOptions>} configs
 */
export function preConfigCompiler(configs: Partial<IConfigCompilerOptions>) {
  return compileFn(configs);
}

/**
 * ## astroboy.ts 中间件预处理函数
 * * 硬核初始化middleware
 * @author Big Mogician
 * @export
 * @param {Partial<IMiddlewareCompilerOptions>} configs
 */
export function preMiddlewareCompiler(configs: Partial<IMiddlewareCompilerOptions>) {
  return middlewareCompileFn(configs);
}

export interface IEnv extends E {}
export interface IRouterConfig extends RConfig {}
export interface IConfig extends CmdConfig {
  env?: IEnv;
  routers?: IRouterConfig;
}

export function create(config: IConfig) {
  return createCmdConfig(config);
}

export function merge(mergeO: IConfig, config: IConfig) {
  return mergeCmdConfig(mergeO, config);
}
