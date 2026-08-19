import { defineConfig } from 'vite'
import type { ProxyOptions } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { registerCopilot } from './src/server/copilot'

// TaxIQ SSE 流式：关闭代理缓冲，让 data: 片段实时到达
// （token 由 registerCopilot 模块加载 .env 注入 process.env，前端源码/包零持有）
const applySseNoBuffering: ProxyOptions['configure'] = (proxy) => {
  proxy.on('proxyRes', (proxyRes) => {
    if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
      proxyRes.headers['cache-control'] = 'no-cache, no-transform'
      proxyRes.headers['x-accel-buffering'] = 'no'
      delete proxyRes.headers['content-length']
      delete proxyRes.headers['content-encoding']
    }
  })
}


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  base: '/chuhai-test/',
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    {
      name: 'compliance-copilot-proxy',
      configureServer(server) { registerCopilot(server); },
    },
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // TaxIQ 国别税策智能体（中经国别助手，中经社）——开发期代理转发；
  // 生产走 nginx /api/taxiq/（已配置同款 Authorization 与 SSE 不缓冲）
  server: {
    proxy: {
      '/api/taxiq': {
        target: 'https://gp.cnfic.com.cn/idis_industry/teis',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/taxiq/, ''),
        headers: { Authorization: process.env.TAXIQ_TOKEN || '' },
        configure: applySseNoBuffering,
      },
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  // Workaround: dist/ has a corrupt dir entry on this exFAT volume (delete/rename
  // both fail with access-denied). Build to a fresh dir; run `chkdsk E: /f`
  // (elevated) to repair, then revert this to default.
  build: { outDir: 'dist-prod' },
})
