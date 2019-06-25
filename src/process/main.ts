import * as ts from "typescript";
import { CancellationToken as CT } from "../utils/cancellation-token";

async function run(ct: CT) {
  try {
    ct.throwIfCancellationRequested();
    // TODO
  } catch (error) {
    if (error instanceof ts.OperationCanceledException) {
      return;
    }
    throw error;
  }

  if (!ct.isCancellationRequested()) {
    try {
      // TODO
    } catch (e) {
      process.exit();
    }
  }
}

async function reload() {}

process.on("message", message => {
  try {
    const { type, message: msg } = JSON.parse(message);
    if (type === "run") {
      run(CT.createFromJSON(ts, msg));
    } else {
      reload();
    }
  } catch (error) {
    process.send!({ error });
    process.exit();
  }
});

process.on("SIGINT", () => {
  process.exit();
});
