import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import 'element-plus/dist/index.css';
import App from './App.vue';
import router from './router';
import { setupDirectives } from './directives/perm';
import { setUnauthorizedHandler } from './api';
import './assets/styles/index.scss';

const app = createApp(App);

app.use(createPinia());
// 图标全局注册：路由 meta.icon 用的是字符串名，需要能按名取到组件
for (const [name, comp] of Object.entries(ElementPlusIconsVue)) {
  app.component(name, comp);
}
app.use(ElementPlus, { locale: zhCn });
app.use(router);
setupDirectives(app);

// token 刷新彻底失败时踢回登录页。放这里而不是 request.ts，是为了不让请求层依赖 router
setUnauthorizedHandler(() => {
  const current = router.currentRoute.value.fullPath;
  void router.replace({ path: '/login', query: current === '/' ? undefined : { redirect: current } });
});

app.mount('#app');
