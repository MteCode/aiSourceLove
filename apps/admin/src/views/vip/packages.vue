<template>
  <div class="page">
    <el-alert
      type="info"
      :closable="false"
      class="tip"
      title="VIP 套餐"
      description="权益一律按「次数 / 天数」配置，不做无限——无限权益卖一次就没复购，也没法做成本控制（AI 匹配是真金白银的调用）。改套餐不影响已售出订单，它们有快照。"
    />

    <div class="page-card">
      <div class="table-toolbar">
        <span class="title">套餐列表</span>
        <el-button v-perm="'vip:manage'" type="primary" :icon="Plus" @click="open()">新建套餐</el-button>
      </div>

      <div v-loading="loading" class="cards">
        <el-empty v-if="!packages.length" description="还没有套餐" />
        <div v-for="p in packages" :key="p.id" :class="['pkg', { disabled: !p.enabled }]">
          <div class="pkg-head">
            <div>
              <span class="pkg-name">{{ p.name }}</span>
              <el-tag v-if="p.isRecommended" type="danger" size="small" effect="dark">推荐</el-tag>
              <el-tag v-if="!p.enabled" type="info" size="small">已下架</el-tag>
            </div>
            <span class="text-muted">排序 {{ p.sort }}</span>
          </div>

          <div class="text-muted subtitle">{{ p.subtitle || '　' }}</div>

          <div class="price">
            <span class="cur">¥</span>{{ fen2yuan(p.price) }}
            <span v-if="p.originalPrice" class="origin">¥{{ fen2yuan(p.originalPrice) }}</span>
          </div>
          <div class="text-muted duration">有效期 {{ p.durationDays }} 天</div>

          <el-divider />

          <ul class="benefits">
            <li v-for="b in p.benefits" :key="b.code">
              <el-icon class="text-success"><Select /></el-icon>
              {{ BENEFIT_META[b.code]?.label ?? b.code }}
              <strong>{{ b.quota }}</strong> {{ BENEFIT_META[b.code]?.unit ?? '' }}
              <span class="text-muted">（{{ RESET_CYCLE_LABEL[b.cycle ?? BENEFIT_META[b.code]?.defaultCycle] }}）</span>
            </li>
            <li v-if="!p.benefits.length" class="text-muted">未配置权益</li>
          </ul>

          <div v-perm="'vip:manage'" class="pkg-ops">
            <el-button link type="primary" @click="open(p)">编辑</el-button>
            <el-popconfirm title="有订单的套餐会自动改为下架而不是删除，确定吗？" @confirm="remove(p)">
              <template #reference>
                <el-button link type="danger">删除</el-button>
              </template>
            </el-popconfirm>
          </div>
        </div>
      </div>
    </div>

    <PackageDialog v-model="visible" :pkg="editing" @done="load" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Select } from '@element-plus/icons-vue';
import { BENEFIT_META, RESET_CYCLE_LABEL, type VipPackageDto } from '@yuanqiao/shared';
import { vipApi } from '@/api';
import { fen2yuan } from '@/utils/format';
import PackageDialog from './components/PackageDialog.vue';

const loading = ref(false);
const packages = ref<VipPackageDto[]>([]);
const visible = ref(false);
const editing = ref<VipPackageDto | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  try {
    packages.value = await vipApi.all();
  } finally {
    loading.value = false;
  }
}

function open(p?: VipPackageDto): void {
  editing.value = p ?? null;
  visible.value = true;
}

async function remove(p: VipPackageDto): Promise<void> {
  await vipApi.remove(p.id);
  ElMessage.success('已处理');
  void load();
}

onMounted(load);
</script>

<style scoped>
.tip {
  margin-bottom: 12px;
}

.cards {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.pkg {
  width: 260px;
  padding: 16px;
  border: 1px solid var(--yq-border);
  border-radius: 10px;
  transition: box-shadow 0.2s;
}

.pkg:hover {
  box-shadow: 0 4px 14px rgb(0 0 0 / 8%);
}

.pkg.disabled {
  opacity: 0.6;
  background: var(--yq-bg);
}

.pkg-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}

.pkg-name {
  margin-right: 6px;
  font-size: 16px;
  font-weight: 600;
}

.subtitle {
  min-height: 20px;
  margin-top: 4px;
  font-size: 12px;
}

.price {
  margin-top: 10px;
  font-size: 28px;
  font-weight: 700;
  color: var(--yq-primary);
}

.price .cur {
  font-size: 16px;
}

.price .origin {
  margin-left: 8px;
  font-size: 13px;
  font-weight: 400;
  color: var(--yq-text-secondary);
  text-decoration: line-through;
}

.duration {
  font-size: 12px;
}

.benefits {
  margin: 0;
  padding-left: 0;
  list-style: none;
  font-size: 13px;
  line-height: 2;
}

.pkg-ops {
  margin-top: 10px;
  text-align: right;
}
</style>
