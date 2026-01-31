import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import versionJson from '../version.json'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const hmrHost = env.VITE_HMR_HOST
  const hmrProtocol = env.VITE_HMR_PROTOCOL || 'ws'

  return {
    // Оптимизированные ассеты для production (только используемые файлы)
    publicDir: path.resolve(__dirname, '../assets-dist'),
    // Инжекция версии из version.json (единый источник правды)
    define: {
      __APP_VERSION__: JSON.stringify(versionJson.version)
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: true, // Разрешить доступ из локальной сети
      hmr: hmrHost
        ? {
            host: hmrHost,
            protocol: hmrProtocol
          }
        : true
    },
    resolve: {
      alias: {
        'react': 'preact/compat',
        'react-dom': 'preact/compat',
        '@slime-arena/shared': path.resolve(__dirname, '../shared/src/index')
      }
    }
  }
})
