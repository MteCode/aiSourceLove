/// <reference types="vite/client" />
/// <reference types="@dcloudio/types" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
  /** 小程序专用绝对地址；小程序不认相对路径 */
  readonly VITE_API_BASE_MP?: string;
  readonly VITE_PROXY_TARGET?: string;
  /** 'on' 才展示支付入口，见 utils/feature.ts */
  readonly VITE_FEATURE_PAY?: string;
  /** 'on' 才展示微信一键登录，后端要先配好 appid/secret */
  readonly VITE_FEATURE_WX_LOGIN?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
