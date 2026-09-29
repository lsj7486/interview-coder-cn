/**
 * 准备开发期专用的 Electron bundle（仅 macOS）。
 *
 * 背景：macOS 在进程诞生的一瞬间就决定它有没有 Dock 图标，等 JS 跑到
 * `app.dock.hide()` 时图标早已画出来了，所以开发时总能看到 Electron 图标闪一下。
 * 唯一的根治办法是让系统从一开始就把这个进程当成 agent 应用 —— 也就是给
 * Electron.app 的 Info.plist 打上 LSUIElement。
 *
 * 为什么不直接改 node_modules：打包时 electron-builder 会不会用到这份 dist
 * 不值得去赌。这里用 APFS 克隆（copy-on-write，几乎不占额外磁盘）复制一份到
 * .electron-dev/，只给开发期用，由 dev.command 通过 ELECTRON_OVERRIDE_DIST_PATH
 * 指过来。node_modules 里的原件保持原样。
 *
 * 为什么不重新签名：实测改完 plist 后二进制照样能跑（arm64 校验的是主可执行文件
 * 的签名，而 plist 注入不触及它）。反过来，重签会把代码签名身份从 `Electron`
 * 变成 `com.github.Electron`，而 macOS 的屏幕录制授权是绑定签名身份的 —— 那样会
 * 逼用户重新授权，对一个靠截屏吃饭的应用来说得不偿失。
 *
 * 幂等：已经准备好就直接退出，dev.command 每次启动都会调它。
 */

import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'node_modules', 'electron', 'dist')
const target = join(root, '.electron-dev')
const plist = join(target, 'Electron.app', 'Contents', 'Info.plist')

function readLSUIElement() {
  try {
    return execFileSync('plutil', ['-extract', 'LSUIElement', 'raw', plist], {
      encoding: 'utf8'
    }).trim()
  } catch {
    // 键不存在时 plutil 会以非零退出，对我们是「未打补丁」的正常情况
    return ''
  }
}

function main() {
  // macOS 之外没有 Dock 这回事
  if (process.platform !== 'darwin') return

  if (!existsSync(source)) {
    console.warn('[dev-electron] 找不到 node_modules/electron/dist，先跑一次 npm install')
    return
  }

  if (existsSync(plist) && readLSUIElement() === 'true') return

  rmSync(target, { recursive: true, force: true })
  try {
    // -c 走 clonefile，APFS 上瞬间完成且不复制数据块
    execFileSync('cp', ['-Rc', source, target])
  } catch {
    execFileSync('cp', ['-R', source, target])
  }

  execFileSync('plutil', ['-insert', 'LSUIElement', '-bool', 'true', plist])
  console.log('[dev-electron] 已准备 .electron-dev（LSUIElement=true，未重新签名）')
}

main()
