import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // 开发期走 Vite 代理，前端只认相对路径 /api，省掉本地跨域和环境变量切换
  const target = env.VITE_PROXY_TARGET || 'http://localhost:3000';

  return {
    plugins: [
      vue(),
      AutoImport({ imports: ['vue', 'vue-router', 'pinia'], resolvers: [ElementPlusResolver()], dts: 'src/auto-imports.d.ts' }),
      Components({ resolvers: [ElementPlusResolver()], dts: 'src/components.d.ts' }),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': { target, changeOrigin: true },
        // 上传的图片不走 /api 前缀
        '/uploads': { target, changeOrigin: true },
      },
    },
    build: {
      outDir: 'dist',
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            vue: ['vue', 'vue-router', 'pinia'],
            element: ['element-plus', '@element-plus/icons-vue'],
            echarts: ['echarts'],
          },
        },
      },
    },
  };
});
