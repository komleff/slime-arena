import { defineConfig } from 'vite'

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
        : undefined
    }
  }
})
