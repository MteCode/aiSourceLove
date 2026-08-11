<template>
  <el-menu
    :default-active="active"
    :collapse="app.collapsed"
    :collapse-transition="false"
    background-color="#1f2733"
    text-color="#c0c4cc"
    active-text-color="#fff"
    router
    unique-opened
  >
    <template v-for="group in menus" :key="group.path">
      <!-- 只有一个子菜单时不套折叠层，少一次点击 -->
      <el-menu-item v-if="group.children.length === 1" :index="group.children[0].path">
        <el-icon><component :is="group.children[0].icon" /></el-icon>
        <template #title>
          <span>{{ group.children[0].title }}</span>
          <el-badge v-if="badgeOf(group.children[0])" :value="badgeOf(group.children[0])" :max="99" class="menu-badge" />
        </template>
      </el-menu-item>

      <el-sub-menu v-else :index="group.path">
        <template #title>
          <el-icon><component :is="group.icon" /></el-icon>
          <span>{{ group.title }}</span>
        </template>
        <el-menu-item v-for="item in group.children" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>
            <span>{{ item.title }}</span>
            <el-badge v-if="badgeOf(item)" :value="badgeOf(item)" :max="99" class="menu-badge" />
          </template>
        </el-menu-item>
      </el-sub-menu>
    </template>
  </el-menu>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { routes } from '@/router';
import { useAppStore, useUserStore } from '@/stores';

interface MenuItem {
  path: string;
  title: string;
  icon: string;
  badge?: string;
}
interface MenuGroup extends MenuItem {
  children: MenuItem[];
}

const route = useRoute();
const app = useAppStore();
const user = useUserStore();

const active = computed(() => route.path);

/** 菜单从路由表推导：加页面只改 routes，菜单自动跟上，不用两处维护 */
const menus = computed<MenuGroup[]>(() => {
  const result: MenuGroup[] = [];
  for (const r of routes) {
    if (r.meta?.hidden || !r.children?.length) continue;

    const children: MenuItem[] = [];
    for (const c of r.children) {
      if (c.meta?.hidden) continue;
      if (!user.can(c.meta?.perm)) continue;
      children.push({
        path: joinPath(r.path, c.path),
        title: c.meta?.title ?? '',
        icon: c.meta?.icon ?? 'Menu',
        badge: c.meta?.badge,
      });
    }
    if (!children.length) continue;

    result.push({
      path: r.path,
      title: r.meta?.title ?? children[0].title,
      icon: r.meta?.icon ?? 'Menu',
      children,
    });
  }
  return result;
});

function joinPath(parent: string, child: string): string {
  if (child.startsWith('/')) return child;
  return `${parent.replace(/\/$/, '')}/${child}`;
}

function badgeOf(item: MenuItem): number {
  if (item.badge === 'profilePending') return user.pending.profilePending;
  return 0;
}
</script>

<style scoped>
.el-menu {
  border-right: none;
}

.menu-badge {
  margin-left: 8px;
  vertical-align: middle;
}
</style>
