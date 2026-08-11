import { defineConfig, loadEnv } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [uni()],
    server: {
      port: 5174,
      proxy: {
        // H5 调试走代理；小程序端没有跨域概念，走 VITE_API_BASE 的绝对地址
        '/api': { target: env.VITE_PROXY_TARGET || 'http://localhost:3000', changeOrigin: true },
        '/uploads': { target: env.VITE_PROXY_TARGET || 'http://localhost:3000', changeOrigin: true },
      },
    },
  };
});
