import { ICommandPlugin } from "../base";
import { action } from "./dev";

export const CompilePlugin: ICommandPlugin = {
  name: "compile",
  description: "编译app",
  options: [["-C, --config [exoConfig]", "使用自定义的exoskeleton.config.js配置文件"]],
  help: () => {
    console.log("");
  },
  async action(_: string, command: any) {
    if (_ !== "compile") return;
    return action(true, command);
  }
};
