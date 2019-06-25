import { defaultConfigCompilerOptions as defaultM } from "../builders/middleware-cmp";
import { defaultConfigCompilerOptions as defaultC } from "../builders/config-compiler";
import { defaultRouterOptions as defaultR } from "../builders/routers";
import { IMiddlewareCompilerCmdConfig, IConfigCompilerCmdConfig, IRouterConfig } from "../base";

function resolveMiddlewaresConfig(configs: IMiddlewareCompilerCmdConfig): IMiddlewareCompilerCmdConfig {
  const { rootFolder: root, outFolder: output, ...others } = defaultM;
  return {
    root,
    output,
    ...others,
    ...configs
  };
}

function resolveConfigsConfig(configs: IConfigCompilerCmdConfig): IConfigCompilerCmdConfig {
  const { outRoot: outputroot, configRoot: configroot, ...others } = defaultC;
  return {
    outputroot,
    configroot,
    ...others,
    ...configs
  };
}

function resolveRoutersConfig(configs: IRouterConfig): IRouterConfig {
  const { appRoot: approot, fileType: filetype, ...others } = defaultR;
  return {
    approot,
    filetype,
    ...others,
    ...configs
  };
}

export const TRANSFROM = {
  middlewares: resolveMiddlewaresConfig,
  configs: resolveConfigsConfig,
  routers: resolveRoutersConfig
};
