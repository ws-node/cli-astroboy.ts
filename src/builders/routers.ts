import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import rimraf from "rimraf";

export interface IInnerRouterOptions extends IRouterOptions {
  ctorFolder: string;
  routerFolder: string;
}

export interface IRouterOptions {
  /** 是否自动生成2.0的routers，默认：`false` */
  enabled: boolean;
  /** 是否强制刷新2.0的routers，默认：`false` */
  always: boolean;
  /** 整个项目的url前缀，默认：`'/'` */
  appRoot: string;
  /** 生成router文件的文件类型，默认：`'js'` */
  fileType: "js" | "ts";
}

export const defaultRouterOptions: IInnerRouterOptions = {
  enabled: false,
  always: false,
  ctorFolder: "app/controllers",
  routerFolder: "app/routers",
  appRoot: "/",
  fileType: "js"
};

interface IRouter {
  [prop: string]: string | IRouter;
}

export function initRouters(
  {
    ctorFolder: base = defaultRouterOptions.ctorFolder,
    routerFolder: routerBase = defaultRouterOptions.routerFolder,
    enabled: open = defaultRouterOptions.enabled,
    always = defaultRouterOptions.always,
    appRoot: root = defaultRouterOptions.appRoot,
    fileType = defaultRouterOptions.fileType
  }: Partial<IInnerRouterOptions>,
  onEnd?: (data: { routers?: IRouter; error?: Error }) => void
) {
  if (open) {
    try {
      const routers: IRouter = {};
      const ctorPath = base;
      const routerPath = routerBase;
      console.log(`force ==> ${chalk.magenta(String(!!always))}`);
      console.log(`HMR   ==> ${chalk.magenta(String(false))}`);
      console.log("");
      if (!!always) {
        // 硬核开关，强撸routers文件夹
        rimraf.sync(routerPath);
        fs.mkdirSync(routerPath, { recursive: true });
      } else if (!fs.existsSync(routerPath)) {
        fs.mkdirSync(routerPath, { recursive: true });
      }
      checkRouterFolders({
        turn: 0,
        baseRouter: routerPath,
        folders: fs.readdirSync(ctorPath),
        ctorPath,
        routerPath,
        fileType,
        routers,
        root
      });
      onEnd && onEnd({ routers });
    } catch (e) {
      onEnd && onEnd({ error: e });
    }
  }
}

function checkRouterFolders({
  turn,
  baseRouter,
  folders,
  ctorPath,
  routerPath,
  fileType,
  root,
  routers
}: {
  turn: number;
  baseRouter: string;
  folders: string[];
  ctorPath: string;
  routerPath: string;
  fileType: string;
  root: string;
  routers: IRouter;
}) {
  folders.forEach(filepath => {
    if (filepath.indexOf(".") === -1) {
      routers[filepath] = {};
      const routerFolder = path.join(routerPath, filepath);
      const ctorFolder = path.join(ctorPath, filepath);
      if (!fs.existsSync(routerFolder)) {
        fs.mkdirSync(routerFolder, { recursive: true });
      }
      checkRouterFolders({
        turn: turn + 1,
        baseRouter,
        folders: fs.readdirSync(ctorFolder),
        ctorPath: ctorFolder,
        routerPath: routerFolder,
        fileType,
        routers: <IRouter>routers[filepath],
        root
      });
    } else {
      if (checkIfOnlyDeclares(filepath)) return;
      createTsRouterFile({
        turn,
        baseRouter,
        ctorPath,
        routerPath,
        path: filepath,
        fileType,
        urlRoot: root,
        routers
      });
    }
  });
}

function checkIfOnlyDeclares(p: string): any {
  return p.endsWith(".d.ts");
}

function createTsRouterFile({
  turn,
  baseRouter,
  ctorPath,
  routerPath,
  path: filepath,
  fileType,
  urlRoot,
  routers
}: {
  turn: number;
  baseRouter: string;
  ctorPath: string;
  routerPath: string;
  path: string;
  fileType: string;
  urlRoot: string;
  routers: IRouter;
}) {
  try {
    // .开头的文件默认不解析
    if (filepath.startsWith(".")) return;
    // 尝试按照新版逻辑解析Controller
    const commonName = filepath.split(".")[0];
    const controller = require(path.join(ctorPath, commonName));
    // 找不到router源定义，静默退出
    if (!controller.prototype["@router"]) return;
    // 非V2，则判断是老版本的Router
    if (!controller.prototype["@router::v2"]) return;
    const file = createFile(routerPath, baseRouter, commonName, turn, fileType, urlRoot);
    const _PATH = path.join(routerPath, `${commonName}.${fileType}`);
    if (fs.existsSync(_PATH)) {
      const oldFile = fs.readFileSync(_PATH, { flag: "r" });
      const content = (oldFile.toString() || "").split("\n");
      // 存在router.js文件，且内容一致，不做处理直接退出
      if (content[1] === file[1] && content[3] === file[3]) return;
    }
    // 复写router.js文件
    fs.appendFileSync(_PATH, file.join("\n"), { flag: "w" });
    routers[`${commonName}.${fileType}`] = "success";
  } catch (e) {
    throw e;
  }
}

function createFile(
  routerPath: string,
  baseRouter: string,
  commonName: string,
  turn: number,
  fileType: string,
  urlRoot: string
) {
  const controllerName =
    routerPath === baseRouter
      ? commonName
      : `${path
          .relative(baseRouter, routerPath)
          .replace(/\//g, ".")
          .replace(/\\/g, ".")}.${commonName}`;
  const turnLod = [".."];
  for (let index = 0; index < turn; index++) {
    turnLod.push("..");
  }
  const turnStr =
    routerPath === baseRouter
      ? path.join(...turnLod, "controllers", commonName)
      : path.join(...turnLod, "controllers", path.relative(baseRouter, routerPath), commonName);
  const file =
    fileType === "ts" ? createTsFile(turnStr, controllerName, urlRoot) : createJsFile(turnStr, controllerName, urlRoot);
  return file;
}

function createTsFile(turnStr: string, controllerName: string, urlRoot: string): string[] {
  return [
    "// [@exoskeleton/cli] 自动生成的代码",
    `import CTOR from "${turnStr}";`,
    `import { buildRouter } from "@exoskeleton/core";`,
    `export = buildRouter(CTOR, "${controllerName}", "${urlRoot}");`
  ];
}

function createJsFile(turnStr: string, controllerName: string, urlRoot: string): string[] {
  return [
    "// [@exoskeleton/cli] 自动生成的代码",
    `const CTOR = require("${turnStr}");`,
    `const { buildRouter } = require("@exoskeleton/core");`,
    `module.exports = buildRouter(CTOR, "${controllerName}", "${urlRoot}");`
  ];
}
