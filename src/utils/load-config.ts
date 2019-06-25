import chalk from "chalk";
import path from "path";
import { IInnerCmdConfig } from "../base";

export function loadConfig(root: string, fileName: string | undefined, defaultName = "exoskeleton.config.js") {
  // tslint:disable-next-line: variable-name
  const _name = path.join(root, fileName || defaultName);
  let config: IInnerCmdConfig;
  try {
    config = require(_name) || {};
  } catch (error) {
    console.log(error);
    console.log(chalk.yellow("未配置exoskeleton配置文件或者解析文件异常, 使用默认配置"));
    config = {};
  }
  return config;
}
