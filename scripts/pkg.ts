import { IConfig } from "@bigmogician/publisher/actions";

export const config: IConfig = {
  rc: false,
  add: 0,
  useYarn: false,
  whiteSpace: "  ",
  debug: false,
  register: "http://registry.npm.s.qima-inc.com",
  outTransform: json => ({
    ...json,
    main: "index.js",
    types: "index.d.ts",
    "ts:main": undefined,
    scripts: undefined,
    nyc: undefined,
    devDependencies: undefined,
    workspaces: undefined,
    private: undefined
  })
};
