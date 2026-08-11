<template>
  <div class="page">
    <div class="page-card query-bar">
      <el-form :inline="true" :model="query" @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="query.keyword" placeholder="手机号 / 昵称" clearable style="width: 190px" @keyup.enter="search" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="query.roleCode" placeholder="全部" clearable style="width: 140px">
            <el-option v-for="(label, code) in ROLE_LABEL" :key="code" :label="label" :value="code" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="正常" value="ACTIVE" />
            <el-option label="已封禁" value="BANNED" />
            <el-option label="已注销" value="DEACTIVATED" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="search">查询</el-button>
          <el-button :icon="Refresh" @click="reset">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <PageTable
      :rows="rows"
      :total="total"
      :page="page"
      :page-size="pageSize"
      :loading="loading"
      title="账号列表"
      @page-change="onPageChange"
      @size-change="onSizeChange"
    >
      <template #toolbar>
        <el-button v-perm="'system:user:edit'" type="primary" :icon="Plus" @click="openCreate">新建后台账号</el-button>
      </template>

      <el-table-column label="用户" min-width="180">
        <template #default="{ row }">
          <div class="user-cell">
            <el-avatar :size="34" :src="row.avatar || undefined">{{ (row.nickname || row.phone)[0] }}</el-avatar>
            <div>
              <div class="name">
                {{ row.nickname || '未设置昵称' }}
                <el-tag v-if="row.isVip" type="warning" size="small" effect="dark">VIP</el-tag>
              </div>
              <div class="text-muted mono">{{ row.phone }}</div>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="角色" min-width="180">
        <template #default="{ row }">
          <el-tag v-for="r in row.roles" :key="r.code" size="small" class="role-tag">{{ r.name }}</el-tag>
          <span v-if="!row.roles.length" class="text-muted">无</span>
        </template>
      </el-table-column>
      <el-table-column label="档案" width="150">
        <template #default="{ row }">
          <el-link v-if="row.profile" type="primary" @click="$router.push(`/member/detail/${row.profile.id}`)">
            <span class="mono">{{ row.profile.serialNo }}</span>
          </el-link>
          <span v-else class="text-muted">未填档案</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }"><DictTag dict="userStatus" :value="row.status" /></template>
      </el-table-column>
      <el-table-column label="最近登录" width="150">
        <template #default="{ row }">{{ formatDate(row.lastLoginAt) }}</template>
      </el-table-column>
      <el-table-column label="注册时间" width="150">
        <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="210" fixed="right" align="center">
        <template #default="{ row }">
          <el-button v-perm="'system:user:edit'" link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button v-perm="'system:user:edit'" link type="warning" @click="resetPassword(row)">重置密码</el-button>
          <el-button
            v-perm="'system:user:edit'"
            link
            :type="row.status === 'ACTIVE' ? 'danger' : 'success'"
            @click="toggleBan(row)"
          >
            {{ row.status === 'ACTIVE' ? '封禁' : '解封' }}
          </el-button>
        </template>
      </el-table-column>
    </PageTable>

    <el-dialog v-model="visible" :title="editing ? `编辑：${editing.nickname ?? editing.phone}` : '新建后台账号'" width="460px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" :disabled="!!editing" placeholder="作为登录账号" />
        </el-form-item>
        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="form.nickname" />
        </el-form-item>
        <el-form-item v-if="!editing" label="初始密码" prop="password">
          <el-input v-model="form.password" type="password" show-password placeholder="至少 8 位" />
        </el-form-item>
        <el-form-item label="角色" prop="roleCodes">
          <el-select v-model="form.roleCodes" multiple style="width: 100%">
            <el-option v-for="(label, code) in ROLE_LABEL" :key="code" :label="label" :value="code" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { Plus, Refresh, Search } from '@element-plus/icons-vue';
import { ROLE_LABEL, type UserStatus } from '@yuanqiao/shared';
import { systemApi, type SysUserRow } from '@/api';
import DictTag from '@/components/DictTag.vue';
import PageTable from '@/components/PageTable.vue';
import { usePagedTable } from '@/composables/usePagedTable';
import { formatDate } from '@/utils/format';

interface Query {
  keyword?: string;
  roleCode?: string;
  status?: UserStatus;
}

const { rows, total, page, pageSize, loading, query, load, search, reset, onPageChange, onSizeChange } =
  usePagedTable<SysUserRow, Query>((q) => systemApi.listUsers(q), {
    keyword: '',
    roleCode: undefined,
    status: undefined,
  });

const visible = ref(false);
const saving = ref(false);
const editing = ref<SysUserRow | null>(null);
const formRef = ref<FormInstance>();
const form = reactive({ phone: '', nickname: '', password: '', roleCodes: [] as string[] });

const rules: FormRules = {
  phone: [{ pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }],
  nickname: [{ required: true, message: '请输入昵称', trigger: 'blur' }],
  password: [{ min: 8, message: '密码至少 8 位', trigger: 'blur' }],
  roleCodes: [{ required: true, message: '请至少选择一个角色', trigger: 'change' }],
};

function openCreate(): void {
  editing.value = null;
  Object.assign(form, { phone: '', nickname: '', password: '', roleCodes: [] });
  visible.value = true;
}

function openEdit(row: SysUserRow): void {
  editing.value = row;
  Object.assign(form, {
    phone: row.phone,
    nickname: row.nickname ?? '',
    password: '',
    roleCodes: row.roles.map((r) => r.code),
  });
  visible.value = true;
}

async function submit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  saving.value = true;
  try {
    if (editing.value) {
      await systemApi.updateUser(editing.value.id, { nickname: form.nickname, roleCodes: form.roleCodes });
    } else {
      await systemApi.createUser({
        phone: form.phone,
        nickname: form.nickname,
        password: form.password,
        roleCodes: form.roleCodes,
      });
    }
    ElMessage.success('已保存');
    visible.value = false;
    void load();
  } finally {
    saving.value = false;
  }
}

async function resetPassword(row: SysUserRow): Promise<void> {
  const r = await ElMessageBox.prompt(`为「${row.nickname ?? row.phone}」设置新密码：`, '重置密码', {
    inputType: 'password',
    inputValidator: (v) => ((v?.length ?? 0) >= 8 ? true : '密码至少 8 位'),
  }).catch(() => null);
  if (!r) return;
  await systemApi.updateUser(row.id, { password: r.value });
  ElMessage.success('密码已重置');
}

async function toggleBan(row: SysUserRow): Promise<void> {
  const ban = row.status === 'ACTIVE';
  await ElMessageBox.confirm(
    ban ? '封禁后该账号无法登录，确定吗？' : '确定解除封禁？',
    ban ? '封禁账号' : '解封账号',
    { type: 'warning' },
  );
  await systemApi.updateUser(row.id, { status: ban ? 'BANNED' : 'ACTIVE' });
  ElMessage.success('已处理');
  void load();
}
</script>

<style scoped>
.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-cell .name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.user-cell .mono {
  font-size: 12px;
}

.role-tag {
  margin-right: 4px;
}
</style>
