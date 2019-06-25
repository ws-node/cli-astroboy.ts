# @exoskeleton/cli

@exoskeleton/core 脚手架和 cli 工具

> 配合[@exoskeleton/core](https://github.com/exoskeleton-astroboy/core.git)使用效果更佳

## 安装

> 本地安装

```zsh
npm install @exoskeleton/cli --save-dev
```

```zsh
yarn add @exoskeleton/cli -D
```

> 全局安装

```zsh
npm install @exoskeleton/cli --global
```

```zsh
yarn global add @exoskeleton/cli
```

### 开发姿势

#### 0.cli 配置文件

@exoskeleton/cli 开放了一个配置文件，用来简化 cli 参数的使用，类似 webpack，可以使用--config 参数修改配置文件的名字，默认为`exoskeleton.config.js`。

> exoskeleton.config.js - 一个简单的配置文件

```javascript
const path = require("path");

module.exports = {
  tsconfig: "tsconfig.json",
  inspect: true,
  typeCheck: true,
  transpile: true,
  debug: "*",
  mock: "http://127.0.0.1:8001",
  // exoskeleton router 的命令配置
  // 编译生成routers，不再需要手动书写routers文件
  routers: {
    enabled: true,
    always: false,
    approot: "/v1",
    filetype: "ts",
    details: true
  },
  // exoskeleton-cli监控的文件修改列表，自动重启node服务
  watch: [
    path.join(__dirname, "app/**/*.*"),
    path.join(__dirname, "config/**/*.*"),
    path.join(__dirname, "plugins/**/*.*")
  ],
  // 忽略的文件列表
  ignore: [],
  // exoskeleton config 的命令配置
  // 编译ts配置文件，支持DI能力 @1.1.0 引入
  configCompiler: {
    enabled: true,
    force: true,
    configroot: "app/config",
    outputroot: "config
  }
};
```

#### 1. 启动

```zsh
# cmd：exo 或者 exoskeleton
# 本地安装@exoskeleton/cli
npx exo dev --inspect --tsconfig app/tsconfig.json
# 全局装过@exoskeleton/cli
exo dev --inspect --tsconfig app/tsconfig.json
```
