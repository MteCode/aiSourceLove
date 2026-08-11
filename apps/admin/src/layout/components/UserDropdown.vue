<template>
  <el-dropdown trigger="click" @command="onCommand">
    <span class="trigger">
      <el-avatar :size="28" :src="user.user?.avatar || undefined">
        {{ (user.user?.nickname || '管')[0] }}
      </el-avatar>
      <span class="nick">{{ user.user?.nickname || user.user?.phone }}</span>
      <el-icon><ArrowDown /></el-icon>
    </span>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item disabled>
          <span class="text-muted">{{ roleNames }}</span>
        </el-dropdown-item>
        <el-dropdown-item command="password" divided>修改密码</el-dropdown-item>
        <el-dropdown-item command="logout">退出登录</el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>

  <el-dialog v-model="pwdVisible" title="修改密码" width="420px">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
      <el-form-item label="原密码" prop="oldPassword">
        <el-input v-model="form.oldPassword" type="password" show-password placeholder="请输入原密码" />
      </el-form-item>
      <el-form-item label="新密码" prop="newPassword">
        <el-input v-model="form.newPassword" type="password" show-password placeholder="至少 8 位" />
      </el-form-item>
      <el-form-item label="确认密码" prop="confirm">
        <el-input v-model="form.confirm" type="password" show-password placeholder="再输入一次" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="pwdVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { ROLE_LABEL, type RoleCode } from '@yuanqiao/shared';
import { authApi } from '@/api';
import { useUserStore } from '@/stores';

const router = useRouter();
const user = useUserStore();

const roleNames = computed(() =>
  (user.user?.roles ?? []).map((r) => ROLE_LABEL[r as RoleCode] ?? r).join(' / '),
);

const pwdVisible = ref(false);
const saving = ref(false);
const formRef = ref<FormInstance>();
const form = reactive({ oldPassword: '', newPassword: '', confirm: '' });

const rules: FormRules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 8, message: '密码至少 8 位', trigger: 'blur' },
  ],
  confirm: [
    { required: true, message: '请再输入一次', trigger: 'blur' },
    {
      validator: (_r, v: string, cb) => (v === form.newPassword ? cb() : cb(new Error('两次输入不一致'))),
      trigger: 'blur',
    },
  ],
};

function onCommand(cmd: string): void {
  if (cmd === 'password') {
    form.oldPassword = '';
    form.newPassword = '';
    form.confirm = '';
    pwdVisible.value = true;
  } else if (cmd === 'logout') {
    void doLogout();
  }
}

async function doLogout(): Promise<void> {
  await ElMessageBox.confirm('确定要退出登录吗？', '提示', { type: 'warning' });
  await user.logout();
  void router.replace('/login');
}

async function submit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  saving.value = true;
  try {
    await authApi.changePassword(form.oldPassword, form.newPassword);
    pwdVisible.value = false;
    ElMessage.success('密码已修改，请重新登录');
    await user.logout();
    void router.replace('/login');
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  outline: none;
}

.nick {
  font-size: 14px;
}
</style>
