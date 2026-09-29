#!/bin/bash
# 开发启动器（macOS）。双击即可，或在终端里 ./dev.command
#
# 它做了三件事：
#
# 1. 绕过 npm。npm 每次都设置进程标题（npm/lib/cli/entry.js: process.title = 'npm'），
#    而 macOS 26 会把任何带标题的进程登记为后台应用显示到 Dock 上，于是开发时会多出
#    一个 "npm run dev" 图标。这与终端软件无关（换 iTerm2 也一样），直接调用
#    electron-vite 就没有这层 npm 进程。
#
# 2. 指向打过 LSUIElement 补丁的 Electron bundle，图标从进程诞生起就不存在，也就
#    没有"闪现"可言。必须用 ELECTRON_EXEC_PATH —— electron-vite 的 getElectronPath()
#    只认这个变量，会绕过 electron 模块的 ELECTRON_OVERRIDE_DIST_PATH 直接拼
#    node_modules/electron/dist。
#
# 3. 后台运行。终端不占着，日志进 .dev.log，窗口可以随手关掉而不影响应用。

set -e
cd "$(dirname "$0")"

LOG=".dev.log"
PIDFILE=".dev.pid"

if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "开发服务已经在运行（pid $(cat "$PIDFILE")）。"
  echo "要重启的话，先点应用窗口右上角的 X 退出。"
  exit 0
fi

# 幂等：已经准备好就直接返回
node scripts/setup-dev-electron.mjs

# 只有 macOS 需要改指向；其他平台没有 Dock，用原版即可
if [ "$(uname)" = "Darwin" ] && [ -d "$PWD/.electron-dev" ]; then
  export ELECTRON_EXEC_PATH="$PWD/.electron-dev/Electron.app/Contents/MacOS/Electron"
  # 顺便给直接 require('electron') 的工具也指过去
  export ELECTRON_OVERRIDE_DIST_PATH="$PWD/.electron-dev"
fi

# --logLevel error 只保留错误，不再打印 dev server 地址 / build 成功 / start electron app
nohup ./node_modules/.bin/electron-vite dev --logLevel error > "$LOG" 2>&1 &
echo $! > "$PIDFILE"
disown

echo "已启动，日志见 ${LOG}。"
echo "停止：点应用窗口右上角的 X（开发期关窗即退出）。"
echo "这个终端窗口现在可以直接关掉，不影响运行。"
