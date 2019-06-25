const tsnode = require("ts-node");

const tsconfig = process.env.__TSCONFIG;
const transpile = process.env.__TRANSPILE === "true";

tsnode.register({
  project: tsconfig === "_" ? undefined : tsconfig,
  pretty: true,
  transpileOnly: transpile
});
