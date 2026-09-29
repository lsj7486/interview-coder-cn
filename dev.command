#!/bin/bash
# 开发启动器（macOS）。双击即可，或在终端里 ./dev.command
#
# 为什么不用 npm run dev：
#   npm CLI 会设置进程标题（npm/lib/cli/entry.js: process.title = 'npm'），而
#   macOS 26 新增的「后台进程」机制会把任何带标题的进程登记到 Dock 上，于是开发
#   时会多出一个 "npm run dev" 图标。它和终端软件无关（换 iTerm2 也一样），根因
#   就是 npm 设了这个标题。直接调用 electron-vite 就没有这层 npm 进程。
#
# Dock 上的 Electron 图标由 scripts/setup-dev-electron.mjs 处理：它克隆出一份打了
# LSUIElement 的 bundle 到 .electron-dev/。这里必须用 ELECTRON_EXEC_PATH 指过去 ——
# electron-vite 的 getElectronPath() 只认这个变量；ELECTRON_OVERRIDE_DIST_PATH 是
# `electron` 模块自己的机制，electron-vite 会绕过它直接拼 node_modules/electron/dist。

set -e
cd "$(dirname "$0")"

# 幂等：已经准备好就直接返回
node scripts/setup-dev-electron.mjs

# 只有 macOS 需要改指向；其他平台没有 Dock，用原版即可
if [ "$(uname)" = "Darwin" ] && [ -d "$PWD/.electron-dev" ]; then
  export ELECTRON_EXEC_PATH="$PWD/.electron-dev/Electron.app/Contents/MacOS/Electron"
  # 顺便给直接 require('electron') 的工具也指过去
  export ELECTRON_OVERRIDE_DIST_PATH="$PWD/.electron-dev"
fi

exec ./node_modules/.bin/electron-vite dev
