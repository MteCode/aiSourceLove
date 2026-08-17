import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import NProgressBar from '@/utils/progress';
import { useUserStore } from '@/stores';
import { tokenStore } from '@/utils/storage';

/**
 * 路由即菜单。
 *
 * meta.perm 同时用于「菜单是否展示」和「路由是否可进」，
 * 它的值必须和后端 @RequirePermissions 里的权限点一字不差。
 */
declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    /** 需要的权限点，任一满足即可；不填 = 登录即可见 */
    perm?: string | string[];
    /** Element Plus 图标组件名 */
    icon?: string;
    /** 不在侧栏显示（详情页这类） */
    hidden?: boolean;
    /** 侧栏角标取值来源 */
    badge?: 'profilePending';
  }
}

const Layout = () => import('@/layout/index.vue');

export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', hidden: true },
  },
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '数据看板', icon: 'DataLine', perm: 'dashboard:view' },
      },
    ],
  },
  {
    path: '/member',
    component: Layout,
    meta: { title: '会员管理', icon: 'User' },
    children: [
      {
        path: 'list',
        name: 'ProfileList',
        component: () => import('@/views/profile/list.vue'),
        meta: { title: '会员列表', icon: 'UserFilled', perm: 'profile:list' },
      },
      {
        path: 'audit',
        name: 'ProfileAudit',
        component: () => import('@/views/profile/audit.vue'),
        meta: { title: '资料审核', icon: 'Stamp', perm: 'profile:audit', badge: 'profilePending' },
      },
      {
        path: 'photo-audit',
        name: 'PhotoAudit',
        component: () => import('@/views/profile/photo-audit.vue'),
        meta: { title: '照片审核', icon: 'Picture', perm: 'profile:audit' },
      },
      {
        path: 'detail/:id',
        name: 'ProfileDetail',
        component: () => import('@/views/profile/detail.vue'),
        meta: { title: '会员详情', perm: 'profile:list', hidden: true },
      },
    ],
  },
  {
    path: '/field',
    component: Layout,
    meta: { title: '字段字典', icon: 'Grid' },
    children: [
      {
        path: 'config',
        name: 'FieldConfig',
        component: () => import('@/views/field/index.vue'),
        meta: { title: '字段配置', icon: 'SetUp', perm: 'field:list' },
      },
    ],
  },
  {
    path: '/match',
    component: Layout,
    meta: { title: '匹配引擎', icon: 'MagicStick' },
    children: [
      {
        path: 'workbench',
        name: 'MatchWorkbench',
        component: () => import('@/views/match/workbench.vue'),
        meta: { title: '权重调参台', icon: 'Operation', perm: 'profile:list' },
      },
      {
        path: 'pair',
        name: 'MatchPair',
        component: () => import('@/views/match/pair.vue'),
        meta: { title: '两人契合度', icon: 'Connection', perm: 'profile:list' },
      },
    ],
  },
  {
    path: '/matchmaker',
    component: Layout,
    meta: { title: '红娘系统', icon: 'Female' },
    children: [
      {
        path: 'list',
        name: 'MatchmakerList',
        component: () => import('@/views/matchmaker/list.vue'),
        meta: { title: '红娘管理', icon: 'Avatar', perm: 'matchmaker:list' },
      },
      {
        path: 'introductions',
        name: 'IntroductionList',
        component: () => import('@/views/introduction/list.vue'),
        meta: { title: '牵线工单', icon: 'Link', perm: 'matchmaker:list' },
      },
      {
        path: 'commissions',
        name: 'CommissionList',
        component: () => import('@/views/commission/list.vue'),
        meta: { title: '分润流水', icon: 'Coin', perm: 'commission:list' },
      },
      {
        path: 'withdrawals',
        name: 'WithdrawalList',
        component: () => import('@/views/commission/withdrawal.vue'),
        meta: { title: '提现审核', icon: 'CreditCard', perm: 'withdrawal:list' },
      },
    ],
  },
  {
    path: '/trade',
    component: Layout,
    meta: { title: '交易管理', icon: 'ShoppingCart' },
    children: [
      {
        path: 'packages',
        name: 'VipPackages',
        component: () => import('@/views/vip/packages.vue'),
        meta: { title: 'VIP 套餐', icon: 'Present', perm: 'vip:manage' },
      },
      {
        path: 'orders',
        name: 'OrderList',
        component: () => import('@/views/order/list.vue'),
        meta: { title: '订单管理', icon: 'Tickets', perm: 'order:list' },
      },
      {
        path: 'reconcile',
        name: 'Reconcile',
        component: () => import('@/views/order/reconcile.vue'),
        meta: { title: '对账记录', icon: 'Files', perm: 'order:list' },
      },
    ],
  },
  {
    path: '/system',
    component: Layout,
    meta: { title: '系统管理', icon: 'Setting' },
    children: [
      {
        path: 'users',
        name: 'SysUsers',
        component: () => import('@/views/system/users.vue'),
        meta: { title: '账号管理', icon: 'User', perm: 'system:user:list' },
      },
      {
        path: 'roles',
        name: 'SysRoles',
        component: () => import('@/views/system/roles.vue'),
        meta: { title: '角色权限', icon: 'Key', perm: 'system:role:list' },
      },
      {
        path: 'invites',
        name: 'SysInvites',
        component: () => import('@/views/system/invites.vue'),
        meta: { title: '推广邀请码', icon: 'Share', perm: 'system:user:list' },
      },
      {
        path: 'logs',
        name: 'SysLogs',
        component: () => import('@/views/system/logs.vue'),
        meta: { title: '操作日志', icon: 'Document', perm: 'system:log:list' },
      },
    ],
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/views/error/403.vue'),
    meta: { title: '无权访问', hidden: true },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { title: '页面不存在', hidden: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

const WHITE_LIST = ['/login', '/403', '/404'];

router.beforeEach(async (to) => {
  NProgressBar.start();
  const title = to.meta.title;
  document.title = title ? `${title} · ${import.meta.env.VITE_APP_TITLE}` : import.meta.env.VITE_APP_TITLE;

  if (WHITE_LIST.includes(to.path)) return true;

  if (!tokenStore.access) {
    return { path: '/login', query: to.fullPath === '/' ? undefined : { redirect: to.fullPath } };
  }

  const store = useUserStore();
  // 刷新页面后 store 是空的，先补一次 me 才能判权限
  if (!store.user) {
    try {
      await store.loadMe();
      void store.loadPending();
    } catch {
      store.reset();
      return { path: '/login', query: { redirect: to.fullPath } };
    }
  }

  if (!store.can(to.meta.perm)) return { path: '/403' };
  return true;
});

router.afterEach(() => NProgressBar.done());

export default router;
