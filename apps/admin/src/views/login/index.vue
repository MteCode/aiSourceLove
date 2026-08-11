<template>
  <div class="login">
    <div class="brand">
      <div class="mark">缘</div>
      <h1>缘桥</h1>
      <p>相亲 / 婚恋撮合平台 · 后台管理</p>
    </div>

    <el-card class="box" shadow="always">
      <h2 class="title">账号登录</h2>
      <el-form ref="formRef" :model="form" :rules="rules" size="large" @keyup.enter="submit">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="手机号 / 账号" :prefix-icon="User" clearable />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            :prefix-icon="Lock"
            show-password
          />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="remember">记住账号</el-checkbox>
        </el-form-item>
        <el-button type="primary" class="submit" :loading="loading" @click="submit">登 录</el-button>
      </el-form>

      <p class="tip text-muted">
        默认超管账号见 <span class="mono">apps/server/prisma/seed.ts</span>
      </p>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { Lock, User } from '@element-plus/icons-vue';
import { useUserStore } from '@/stores';
import { rememberedUsername } from '@/utils/storage';

const route = useRoute();
const router = useRouter();
const user = useUserStore();

const formRef = ref<FormInstance>();
const loading = ref(false);
const remember = ref(true);
const form = reactive({ username: '', password: '' });

const rules: FormRules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

onMounted(() => {
  form.username = rememberedUsername.get();
  remember.value = !!form.username;
});

async function submit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    await user.login(form.username, form.password);
    rememberedUsername.set(remember.value ? form.username : '');
    void user.loadPending();
    ElMessage.success(`欢迎回来，${user.user?.nickname ?? ''}`);
    const redirect = route.query.redirect as string | undefined;
    await router.replace(redirect || '/dashboard');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 28px;
  background: linear-gradient(135deg, #fdeef2 0%, #eef2fb 100%);
}

.brand {
  text-align: center;
  color: #303133;
}

.brand .mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  margin-bottom: 10px;
  border-radius: 14px;
  background: var(--yq-primary);
  color: #fff;
  font-size: 26px;
  font-weight: 700;
}

.brand h1 {
  margin: 0;
  font-size: 26px;
  letter-spacing: 4px;
}

.brand p {
  margin: 6px 0 0;
  color: var(--yq-text-secondary);
  font-size: 13px;
}

.box {
  width: 380px;
  border-radius: 12px;
}

.title {
  margin: 0 0 22px;
  font-size: 17px;
  font-weight: 600;
}

.submit {
  width: 100%;
}

.tip {
  margin: 18px 0 0;
  font-size: 12px;
  text-align: center;
}
</style>
