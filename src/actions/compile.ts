import { CommandPlugin } from "../base";
import { action } from "./dev";

export const CompilePlugin: CommandPlugin = {
  name: "compile",
  description: "编译app",
  options: [["-C, --config [atcConfig]", "使用自定义的atc.config.js配置文件"]],
  help: () => {
    console.log("");
  },
  async action(_: string, command: any) {
    if (_ !== "compile") return;
    return await action(true, command);
  }
};
