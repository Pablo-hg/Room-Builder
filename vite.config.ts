import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { diagnosticsPlugin } from './tools/diagnosticsPlugin'

export default defineConfig({
  plugins: [react(), diagnosticsPlugin()],
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.1.0') },
})
