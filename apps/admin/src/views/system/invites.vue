<template>
  <div class="page">
    <el-card shadow="never">
      <template #header>
        <div class="hd">
          <div>
            <span class="title">推广邀请码</span>
            <span class="text-muted">
              　带此码注册的用户才会出现「成为红娘」入口；红娘自己分享拉来的人只能是客户
            </span>
          </div>
          <el-button v-perm="'system:user:edit'" type="primary" @click="dialog = true">生成邀请码</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="rows" border>
        <el-table-column label="邀请码" width="140">
          <template #default="{ row }">
            <span class="mono code">{{ row.code }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
        <el-table-column label="使用情况" width="120">
          <template #default="{ row }">
            {{ row.usedCount }} / {{ row.maxUses === 0 ? '不限' : row.maxUses }}
          </template>
        </el-table-column>
        <el-table-column label="有效期" width="180">
          <template #default="{ row }">
            <span v-if="!row.expiresAt" class="text-muted">永久</span>
            <span v-else :class="{ 'text-danger': expired(row as AdminInviteDto) }">{{ formatDate(row.expiresAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="!row.enabled" type="info" size="small">已停用</el-tag>
            <el-tag v-else-if="expired(row as AdminInviteDto)" type="warning" size="small">已过期</el-tag>
            <el-tag v-else-if="used(row as AdminInviteDto)" type="warning" size="small">已用完</el-tag>
            <el-tag v-else type="success" size="small">可用</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="copyLink(row as AdminInviteDto)">复制链接</el-button>
            <el-button
              v-perm="'system:user:edit'"
              link
              type="danger"
              :disabled="!row.enabled"
              @click="disable(row as AdminInviteDto)"
            >
              停用
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialog" title="生成邀请码" width="440px">
      <el-form label-width="96px">
        <el-form-item label="备注">
          <el-input v-model="form.remark" placeholder="发给谁 / 什么用途，便于日后追溯" maxlength="50" />
        </el-form-item>
        <el-form-item label="有效期">
          <el-select v-model="form.expiresInDays" style="width: 100%">
            <el-option label="永久有效" :value="0" />
            <el-option label="7 天" :value="7" />
            <el-option label="30 天" :value="30" />
            <el-option label="90 天" :value="90" />
          </el-select>
        </el-form-item>
        <el-form-item label="可用次数">
          <el-input-number v-model="form.maxUses" :min="0" :max="9999" style="width: 100%" />
          <div class="text-muted tip">0 = 不限次数。发给单个人建议填 1，避免被转发扩散</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">生成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { systemApi } from '@/api';
import type { AdminInviteDto } from '@/api/types';
import { formatDate } from '@/utils/format';

/**
 * 推广邀请码。
 *
 * 存在的意义：区分注册来路。红娘分享出去的人只能是客户，
 * 带这个码注册的人才允许申请成为红娘。
 */
const rows = ref<AdminInviteDto[]>([]);
const loading = ref(false);
const dialog = ref(false);
const saving = ref(false);
const form = reactive({ remark: '', expiresInDays: 0, maxUses: 0 });

const expired = (r: AdminInviteDto) => !!r.expiresAt && new Date(r.expiresAt).getTime() < Date.now();
const used = (r: AdminInviteDto) => r.maxUses > 0 && r.usedCount >= r.maxUses;

async function load(): Promise<void> {
  loading.value = true;
  try {
    rows.value = await systemApi.listInvites();
  } finally {
    loading.value = false;
  }
}

async function submit(): Promise<void> {
  saving.value = true;
  try {
    const created = await systemApi.createInvite({
      remark: form.remark || undefined,
      expiresInDays: form.expiresInDays || undefined,
      maxUses: form.maxUses,
    });
    dialog.value = false;
    form.remark = '';
    ElMessage.success(`已生成：${created.code}`);
    await load();
  } finally {
    saving.value = false;
  }
}

/**
 * 复制的是小程序页面路径而不是网址。
 * 小程序没有可直接点开的链接，运营拿这个路径去公众平台生成小程序码，
 * 或在「客服消息 / 公众号文章」里配跳转。
 */
function copyLink(row: AdminInviteDto): void {
  const path = `/pages/login/index?inv=${row.code}`;
  navigator.clipboard.writeText(path).then(
    () => ElMessage.success(`已复制：${path}`),
    () => ElMessageBox.alert(path, '手动复制这段路径', { confirmButtonText: '好' }),
  );
}

async function disable(row: AdminInviteDto): Promise<void> {
  await ElMessageBox.confirm(
    `停用后这个码将无法再用于注册。已经用它注册的人不受影响。`,
    `停用 ${row.code}`,
    { type: 'warning' },
  );
  await systemApi.disableInvite(row.id);
  ElMessage.success('已停用');
  await load();
}

onMounted(load);
</script>

<style scoped>
.hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title {
  font-size: 15px;
  font-weight: 600;
}

.code {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 1px;
}

.tip {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
}
</style>
