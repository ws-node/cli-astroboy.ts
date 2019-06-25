import { defaultConfigCompilerOptions as defaultM } from "../builders/middleware-cmp";
import { defaultConfigCompilerOptions as defaultC } from "../builders/config-compiler";
import { defaultRouterOptions as defaultR } from "../builders/routers";
import {
  MiddlewareCompilerCmdConfig,
  ConfigCompilerCmdConfig,
  RouterConfig
} from "../base";

function resolveMiddlewaresConfig(
  configs: MiddlewareCompilerCmdConfig
): MiddlewareCompilerCmdConfig {
  const { rootFolder: root, outFolder: output, ...others } = defaultM;
  return {
    root,
    output,
    ...others,
    ...configs
  };
}

function resolveConfigsConfig(
  configs: ConfigCompilerCmdConfig
): ConfigCompilerCmdConfig {
  const { outRoot: outputroot, configRoot: configroot, ...others } = defaultC;
  return {
    outputroot,
    configroot,
    ...others,
    ...configs
  };
}

function resolveRoutersConfig(configs: RouterConfig): RouterConfig {
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
