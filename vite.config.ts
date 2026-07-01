import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function devTruckLocationApi() {
  const locations = new Map<string, unknown>()

  const sendJson = (res, status, payload) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(payload))
  }

  const readJsonBody = (req) =>
    new Promise((resolve, reject) => {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk
      })
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {})
        } catch (error) {
          reject(error)
        }
      })
      req.on('error', reject)
    })

  return {
    name: 'dev-truck-location-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/truck-live-locations')) {
          next()
          return
        }

        if (req.method === 'GET') {
          sendJson(res, 200, Array.from(locations.values()))
          return
        }

        if (req.method === 'POST') {
          try {
            const payload = await readJsonBody(req)
            if (!payload?.truck_id || typeof payload.latitude !== 'number' || typeof payload.longitude !== 'number') {
              sendJson(res, 400, { error: 'truck_id, latitude, and longitude are required' })
              return
            }

            const nextPayload = {
              ...payload,
              updated_at: payload.updated_at ?? new Date().toISOString()
            }
            locations.set(payload.truck_id, nextPayload)
            sendJson(res, 200, nextPayload)
          } catch (error) {
            sendJson(res, 400, { error: error instanceof Error ? error.message : 'Invalid JSON body' })
          }
          return
        }

        sendJson(res, 405, { error: 'Method not allowed' })
      })
    },
  }
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
  plugins: [
    devTruckLocationApi(),
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    allowedHosts: [
      'stays-hardwood-saga.ngrok-free.dev',
      '.ngrok-free.dev',
      '.ngrok-free.app'
    ],
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
