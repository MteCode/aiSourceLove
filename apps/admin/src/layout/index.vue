<template>
  <el-container class="layout">
    <el-aside :width="app.collapsed ? '64px' : '210px'" class="aside">
      <div class="logo">
        <span class="mark">缘</span>
        <span v-show="!app.collapsed" class="name">缘桥后台</span>
      </div>
      <SidebarMenu />
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="left">
          <el-icon class="collapse-btn" @click="app.toggleSidebar()">
            <Fold v-if="!app.collapsed" />
            <Expand v-else />
          </el-icon>
          <Breadcrumb />
        </div>
        <div class="right">
          <el-tooltip content="刷新待审数量" placement="bottom">
            <el-badge
              :value="totalPending"
              :hidden="totalPending === 0"
              :max="99"
              class="pending-badge"
            >
              <el-icon class="action-icon" @click="user.loadPending()"><Bell /></el-icon>
            </el-badge>
          </el-tooltip>
          <UserDropdown />
        </div>
      </el-header>

      <el-main class="main">
        <router-view v-slot="{ Component }">
          <transition name="route-fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useAppStore, useUserStore } from '@/stores';
import Breadcrumb from './components/Breadcrumb.vue';
import SidebarMenu from './components/SidebarMenu.vue';
import UserDropdown from './components/UserDropdown.vue';

const app = useAppStore();
const user = useUserStore();

const totalPending = computed(() => user.pending.profilePending + user.pending.photoPending);

onMounted(() => {
  void user.loadPending();
});
</script>

<style scoped>
.layout {
  height: 100%;
}

.aside {
  background: #1f2733;
  transition: width 0.22s ease;
  overflow-x: hidden;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  padding: 0 18px;
  color: #fff;
  white-space: nowrap;
}

.logo .mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--yq-primary);
  font-weight: 700;
  flex-shrink: 0;
}

.logo .name {
  font-size: 16px;
  font-weight: 600;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 18px;
  background: #fff;
  border-bottom: 1px solid var(--yq-border);
}

.header .left,
.header .right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.collapse-btn,
.action-icon {
  font-size: 18px;
  cursor: pointer;
  color: #606266;
}

.collapse-btn:hover,
.action-icon:hover {
  color: var(--yq-primary);
}

.pending-badge {
  display: flex;
  align-items: center;
}

.main {
  padding: 0;
  background: var(--yq-bg);
  overflow-y: auto;
}
</style>
