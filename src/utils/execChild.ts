import { ChildProcess, spawn, exec, fork } from "child_process";
import { CancellationToken } from "./cancellation-token";

export interface ChildProcessContext {
  type: "spawn" | "exec" | "fork";
  command?: string;
  args?: string[];
  script?: string;
  env?: { [prop: string]: any };
  slient?: boolean;
  ignoreArgs?: boolean;
  token?: CancellationToken;
  defineCancel?: (child: ChildProcess, token: CancellationToken) => void;
}

export function startChildProcess({
  command = "node",
  script = "",
  args = [],
  env = {},
  slient = false,
  type = "spawn",
  ignoreArgs = false,
  token = undefined,
  defineCancel = undefined
}: ChildProcessContext): Promise<number> {
  return new Promise((resolve, reject) => {
    let child: ChildProcess;
    const useCancel = token && defineCancel;
    const ENV = {
      ...process.env,
      ...env,
      USE_CANCEL: String(useCancel)
    };
    try {
      if (type === "spawn" && !useCancel) {
        child = spawn(command, args, {
          env: ENV,
          stdio: !!slient ? "pipe" : ["pipe", process.stdout, process.stderr]
        });
      } else if (type === "fork" || useCancel) {
        child = fork(script, args, { env: ENV });
      } else {
        child = exec(
          `${command} ${args.join(" ")}`,
          { env: ENV },
          (error, stdout, stderr) => {
            if (error) return reject(error);
            if (stderr) {
              return reject(
                new Error(`child process exit with error ${stderr}`)
              );
            }
            return resolve(0);
          }
        );
      }
    } catch (error) {
      return reject(error);
    }
    if (useCancel) {
      defineCancel(child, token);
    }
    if (type !== "spawn") return;
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(
          new Error(`child process exit with code ${code} [${signal || "-"}]`)
        );
      }
    });
  });
}
