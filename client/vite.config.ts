import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5174,
    hmr: true
  },
  resolve: {
    alias: {
      'react': 'preact/compat',
      'react-dom': 'preact/compat',
      '@slime-arena/shared': path.resolve(__dirname, '../shared/src/index')
    }
  }
})
