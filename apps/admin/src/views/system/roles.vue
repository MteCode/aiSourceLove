<template>
  <div class="page">
    <el-alert
      type="info"
      :closable="false"
      class="tip"
      title="角色权限"
      description="权限点与后端 @RequirePermissions 一一对应。改完立即对该角色下所有用户生效（下次请求就会用新权限判定）。超级管理员不受此表约束，代码里直通全部权限。"
    />

    <el-row :gutter="12">
      <el-col :xs="24" :md="7">
        <div class="page-card">
          <div class="table-toolbar"><span class="title">角色</span></div>
          <div v-loading="loading">
            <div
              v-for="r in roles"
              :key="r.id"
              :class="['role-item', { active: current?.id === r.id }]"
              @click="select(r)"
            >
              <div>
                <div class="name">
                  {{ r.name }}
                  <el-tag v-if="r.code === 'SUPER_ADMIN'" type="danger" size="small">全权限</el-tag>
                </div>
                <div class="text-muted mono">{{ r.code }} · {{ r._count.users }} 人</div>
              </div>
              <el-tag size="small" type="info">{{ r.permissions.length }} 项</el-tag>
            </div>
          </div>
        </div>
      </el-col>

      <el-col :xs="24" :md="17">
        <div class="page-card">
          <div class="table-toolbar">
            <span class="title">
              {{ current?.name ?? '权限' }} 的权限
              <span class="text-muted">（已选 {{ checkedCodes.length }} / {{ allCodes.length }}）</span>
            </span>
            <div>
              <el-button link @click="checkAll(true)">全选</el-button>
              <el-button link @click="checkAll(false)">清空</el-button>
              <el-button
                v-perm="'system:role:edit'"
                type="primary"
                :loading="saving"
                :disabled="!current || current.code === 'SUPER_ADMIN'"
                @click="save"
              >
                保存
              </el-button>
            </div>
          </div>

          <el-alert
            v-if="current?.code === 'SUPER_ADMIN'"
            type="warning"
            :closable="false"
            class="tip"
            title="超级管理员的权限在代码里硬编码为「全部放行」，不需要也不能在这里配置"
          />

          <div v-for="g in permissions" :key="g.module" class="module">
            <div class="module-head">
              <el-checkbox
                :model-value="isModuleAll(g)"
                :indeterminate="isModuleSome(g)"
                :disabled="readonly"
                @change="(v: string | number | boolean) => toggleModule(g, !!v)"
              >
                <strong>{{ g.module }}</strong>
              </el-checkbox>
            </div>
            <el-checkbox-group v-model="checkedCodes" :disabled="readonly" class="perm-group">
              <el-checkbox v-for="p in g.permissions" :key="p.code" :value="p.code">
                {{ p.name }}
                <span class="text-muted mono code">{{ p.code }}</span>
              </el-checkbox>
            </el-checkbox-group>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { systemApi, type PermissionGroup, type RoleRow } from '@/api';
import { useUserStore } from '@/stores';

const user = useUserStore();

const loading = ref(false);
const saving = ref(false);
const roles = ref<RoleRow[]>([]);
const permissions = ref<PermissionGroup[]>([]);
const current = ref<RoleRow | null>(null);
const checkedCodes = ref<string[]>([]);

const allCodes = computed(() => permissions.value.flatMap((g) => g.permissions.map((p) => p.code)));
// 超管权限硬编码，没有 role:edit 权限的人也只能看
const readonly = computed(() => !current.value || current.value.code === 'SUPER_ADMIN' || !user.can('system:role:edit'));

function select(r: RoleRow): void {
  current.value = r;
  checkedCodes.value = r.permissions.map((p) => p.permission.code);
}

function isModuleAll(g: PermissionGroup): boolean {
  return g.permissions.every((p) => checkedCodes.value.includes(p.code));
}

function isModuleSome(g: PermissionGroup): boolean {
  const hit = g.permissions.filter((p) => checkedCodes.value.includes(p.code)).length;
  return hit > 0 && hit < g.permissions.length;
}

function toggleModule(g: PermissionGroup, checked: boolean): void {
  const codes = g.permissions.map((p) => p.code);
  checkedCodes.value = checked
    ? [...new Set([...checkedCodes.value, ...codes])]
    : checkedCodes.value.filter((c) => !codes.includes(c));
}

function checkAll(checked: boolean): void {
  if (readonly.value) return;
  checkedCodes.value = checked ? [...allCodes.value] : [];
}

async function save(): Promise<void> {
  if (!current.value) return;
  saving.value = true;
  try {
    await systemApi.updateRolePermissions(current.value.id, checkedCodes.value);
    ElMessage.success('权限已保存，该角色用户下次请求即生效');
    await load();
  } finally {
    saving.value = false;
  }
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [r, p] = await Promise.all([systemApi.listRoles(), systemApi.listPermissions()]);
    roles.value = r;
    permissions.value = p;
    const keep = current.value ? r.find((x) => x.id === current.value?.id) : r[0];
    if (keep) select(keep);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.tip {
  margin-bottom: 12px;
}

.role-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
}

.role-item:hover {
  background: var(--yq-bg);
}

.role-item.active {
  background: var(--yq-primary-light);
  border-color: var(--yq-primary);
}

.role-item .name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.role-item .mono {
  font-size: 12px;
}

.module {
  padding: 10px 0;
  border-bottom: 1px solid var(--yq-border);
}

.module:last-child {
  border-bottom: none;
}

.module-head {
  margin-bottom: 4px;
}

.perm-group {
  padding-left: 24px;
}

.perm-group .el-checkbox {
  min-width: 240px;
}

.code {
  font-size: 11px;
}
</style>
