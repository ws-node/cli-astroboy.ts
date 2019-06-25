import chalk from "chalk";
import path from "path";
import { InnerCmdConfig } from "../base";

export function loadConfig(
  root: string,
  fileName: string | undefined,
  defaultName = "atc.config.js"
) {
  const _name = path.join(root, fileName || defaultName);
  let config: InnerCmdConfig;
  try {
    config = require(_name) || {};
  } catch (error) {
    console.log(error);
    console.log(
      chalk.yellow("未配置atc配置文件或者解析文件异常, 使用默认配置")
    );
    config = {};
  }
  return config;
}
