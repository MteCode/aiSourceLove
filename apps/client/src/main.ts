import { createSSRApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

// uni-app 要求导出 createApp 而不是自己 mount，
// 这样小程序端才能拿到 app 实例接管生命周期
export function createApp() {
  const app = createSSRApp(App);
  app.use(createPinia());
  return { app };
}
