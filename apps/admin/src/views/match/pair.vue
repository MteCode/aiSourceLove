<template>
  <div class="page">
    <el-alert
      type="info"
      :closable="false"
      class="tip"
      title="两人契合度"
      description="红娘牵线前先看这个：分数只是参考，真正要看的是「打分明细」和「需要注意」——那才是聊天时要提前打的招呼。"
    />

    <div class="page-card">
      <el-row :gutter="16" align="middle">
        <el-col :span="10">
          <el-form label-position="top">
            <el-form-item label="A 方">
              <ProfilePicker v-model="aId" @change="(p) => (aInfo = p)" />
            </el-form-item>
          </el-form>
        </el-col>
        <el-col :span="4" class="middle">
          <el-icon :size="26" color="#e05a7d"><Connection /></el-icon>
        </el-col>
        <el-col :span="10">
          <el-form label-position="top">
            <el-form-item label="B 方">
              <ProfilePicker v-model="bId" @change="(p) => (bInfo = p)" />
            </el-form-item>
          </el-form>
        </el-col>
      </el-row>
      <div class="center">
        <el-button type="primary" :loading="loading" :disabled="!aId || !bId" @click="score">计算契合度</el-button>
      </div>
    </div>

    <div v-if="result" class="page-card">
      <div class="summary">
        <div class="side">
          <el-avatar :size="56" shape="square">{{ aInfo?.displayName?.[0] ?? 'A' }}</el-avatar>
          <div class="name">{{ aInfo?.displayName }}</div>
          <div class="text-muted">{{ aInfo?.age }} 岁 · {{ aInfo?.cityName ?? '-' }}</div>
        </div>

        <div class="score-block">
          <div class="score-num" :style="{ color: scoreColor(result.score) }">{{ result.score }}</div>
          <div class="text-muted">综合契合度</div>
          <div class="bi">
            <div>
              <span class="text-muted">A 满足 B 的要求</span>
              <el-progress :percentage="Math.round(result.aSatisfiesB * 100)" :stroke-width="8" />
            </div>
            <div>
              <span class="text-muted">B 满足 A 的要求</span>
              <el-progress :percentage="Math.round(result.bSatisfiesA * 100)" :stroke-width="8" color="#409eff" />
            </div>
          </div>
        </div>

        <div class="side">
          <el-avatar :size="56" shape="square">{{ bInfo?.displayName?.[0] ?? 'B' }}</el-avatar>
          <div class="name">{{ bInfo?.displayName }}</div>
          <div class="text-muted">{{ bInfo?.age }} 岁 · {{ bInfo?.cityName ?? '-' }}</div>
        </div>
      </div>

      <el-row :gutter="12" class="lists">
        <el-col :span="12">
          <h4 class="text-success">加分点</h4>
          <el-empty v-if="!result.highlights.length" description="无" :image-size="50" />
          <ul>
            <li v-for="h in result.highlights" :key="h">{{ h }}</li>
          </ul>
        </el-col>
        <el-col :span="12">
          <h4 class="text-danger">需要注意</h4>
          <el-empty v-if="!result.concerns.length" description="无" :image-size="50" />
          <ul>
            <li v-for="c in result.concerns" :key="c">{{ c }}</li>
          </ul>
        </el-col>
      </el-row>

      <h4>打分明细</h4>
      <el-table :data="result.details" border size="small">
        <el-table-column prop="label" label="维度" width="180" />
        <el-table-column label="原始分" width="120">
          <template #default="{ row }">
            <el-progress :percentage="Math.round(row.raw * 100)" :stroke-width="6" :show-text="false" />
            <span class="mono">{{ row.raw.toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="权重" width="90">
          <template #default="{ row }">{{ row.weight.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="加权得分" width="100">
          <template #default="{ row }">{{ row.weighted.toFixed(3) }}</template>
        </el-table-column>
        <el-table-column prop="note" label="说明" min-width="200" />
      </el-table>

      <div v-if="result.aiReason" class="ai-reason">
        <el-icon><MagicStick /></el-icon> AI 推荐语：{{ result.aiReason }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Connection, MagicStick } from '@element-plus/icons-vue';
import type { MatchResultDto, ProfileBriefDto } from '@yuanqiao/shared';
import { matchApi } from '@/api';
import ProfilePicker from '@/components/ProfilePicker.vue';

const aId = ref('');
const bId = ref('');
const aInfo = ref<ProfileBriefDto>();
const bInfo = ref<ProfileBriefDto>();
const loading = ref(false);
const result = ref<MatchResultDto | null>(null);

function scoreColor(score: number): string {
  if (score >= 80) return '#67c23a';
  if (score >= 60) return '#e6a23c';
  return '#909399';
}

async function score(): Promise<void> {
  loading.value = true;
  try {
    result.value = await matchApi.scorePair(aId.value, bId.value);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.tip {
  margin-bottom: 12px;
}

.middle,
.center {
  text-align: center;
}

.summary {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  align-items: center;
  gap: 20px;
  padding: 10px 0 20px;
  border-bottom: 1px solid var(--yq-border);
}

.side {
  text-align: center;
  font-size: 13px;
}

.side .name {
  margin-top: 6px;
  font-weight: 600;
}

.score-block {
  text-align: center;
}

.score-num {
  font-size: 46px;
  font-weight: 700;
  line-height: 1;
}

.bi {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 14px;
  font-size: 12px;
  text-align: left;
}

.lists {
  margin: 16px 0;
}

.lists ul {
  margin: 0;
  padding-left: 20px;
  line-height: 1.9;
}

h4 {
  margin: 12px 0 8px;
  font-size: 14px;
}

.ai-reason {
  margin-top: 14px;
  padding: 12px;
  background: var(--yq-primary-light);
  border-radius: 6px;
  line-height: 1.7;
}
</style>
