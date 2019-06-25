import commander from "commander";
import { CommandPlugin } from "./src/base";
import { DevPlugin } from "./src/actions/dev";
import { RouterPlugin } from "./src/actions/routers";
import { ConfigPlugin } from "./src/actions/config";
import { MiddlewarePlugin } from "./src/actions/middleware";
import { CompilePlugin } from "./src/actions/compile";

function initCommand(plugin: CommandPlugin) {
  const program = commander.name(plugin.name).description(plugin.description);
  if (plugin.options) {
    for (let i = 0; i < plugin.options.length; i++) {
      program.option(plugin.options[i][0], plugin.options[i][1]);
    }
  }
  program.action(plugin.action).on("--help", plugin.help);
}

[
  DevPlugin,
  CompilePlugin,
  RouterPlugin,
  ConfigPlugin,
  MiddlewarePlugin
].forEach(i => initCommand(i));

commander.version("1.0.0-rc.1").parse(process.argv);

if (commander.args.length === 0) {
  commander.outputHelp();
}
