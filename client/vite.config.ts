import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig(() => {
  const hmrHost = process.env.VITE_HMR_HOST
  const hmrProtocol = process.env.VITE_HMR_PROTOCOL

  return {
    server: {
      host: '0.0.0.0',
      port: 5174,
      allowedHosts: ['*.overmobile.space'],
      hmr: hmrHost
        ? {
            host: hmrHost,
            protocol: hmrProtocol || 'ws'
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
