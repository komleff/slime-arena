import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5174,
    allowedHosts: ['*.overmobile.space'],
    hmr: {
      host: 'slime-arena.overmobile.space',
      protocol: 'wss'
    }
  },
  resolve: {
    alias: {
      'react': 'preact/compat',
      'react-dom': 'preact/compat'
    }
  }
})
