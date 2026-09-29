import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    server: {
      // 只绑定 IPv4 回环。默认的 localhost 在 Node 17+ 上会解析为 IPv6 [::1]，
      // 而 [::1] 会被代理软件（如 Clash）干扰，导致 Electron 加载不了页面、
      // ready-to-show 不触发、窗口一直不显示。
      host: '127.0.0.1'
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
