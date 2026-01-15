import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
    base: '/PointCloudGenerator/',
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false,
    },
})
