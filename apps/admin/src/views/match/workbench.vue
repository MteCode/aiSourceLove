<template>
  <div class="page">
    <el-alert
      type="info"
      :closable="false"
      class="tip"
      title="匹配权重调参台"
      description="L1 SQL 硬过滤 → L2 双向加权打分 → L3 AI 语义。这里改的权重只影响本次预览，不落库；调出满意的组合后改 shared/constants.ts 的 DEFAULT_MATCH_WEIGHTS 生效。"
    />

    <el-row :gutter="12">
      <el-col :xs="24" :md="8">
        <div class="page-card">
          <div class="table-toolbar"><span class="title">参数</span></div>

          <el-form label-position="top">
            <el-form-item label="给谁匹配">
              <ProfilePicker v-model="profileId" @change="(p) => (target = p)" />
            </el-form-item>

            <el-form-item label="只看城市">
              <RegionCascader v-model="regionValue" @change="(c) => (cityCode = c)" />
            </el-form-item>

            <el-form-item :label="`最低分 ${minScore}`">
              <el-slider v-model="minScore" :min="0" :max="100" />
            </el-form-item>

            <el-form-item>
              <el-checkbox v-model="enableAi">启用 AI 语义层（L3，消耗权益、有成本）</el-checkbox>
            </el-form-item>
          </el-form>

          <el-divider />

          <div class="table-toolbar">
            <span class="title">权重（合计 {{ weightSum.toFixed(2) }}）</span>
            <el-button link @click="resetWeights">恢复默认</el-button>
          </div>
          <div v-for="w in weightList" :key="w.key" class="weight-row">
            <div class="weight-label">
              <span>{{ w.label }}</span>
              <span class="mono">{{ weights[w.key]?.toFixed(2) }}</span>
            </div>
            <el-slider v-model="weights[w.key]" :min="0" :max="1" :step="0.01" size="small" />
          </div>
          <p class="text-muted hint">权重不必加起来等于 1，服务端会归一化。</p>

          <el-button type="primary" class="run-btn" :loading="loading" :disabled="!profileId" @click="run">
            运行预览
          </el-button>
        </div>
      </el-col>

      <el-col :xs="24" :md="16">
        <div class="page-card">
          <div class="table-toolbar">
            <span class="title">
              推荐结果
              <span v-if="target" class="text-muted">
                　为「{{ target.displayName }}」匹配，共 {{ total }} 人
              </span>
            </span>
          </div>

          <el-empty v-if="!results.length && !loading" description="设置参数后点「运行预览」" />

          <div v-loading="loading">
            <div v-for="r in results" :key="r.profile.id" class="result">
              <div class="result-head">
                <el-avatar :size="46" shape="square" :src="r.profile.avatarUrl || undefined">
                  {{ r.profile.displayName?.[0] ?? '?' }}
                </el-avatar>
                <div class="result-info">
                  <div class="name">
                    {{ r.profile.displayName }}
                    <DictTag dict="gender" :value="r.profile.gender" />
                    <span class="mono text-muted">{{ r.profile.serialNo }}</span>
                  </div>
                  <div class="text-muted">
                    {{ r.profile.age }} 岁 ·
                    {{ r.profile.heightCm ? `${r.profile.heightCm}cm` : '身高未填' }} ·
                    {{ r.profile.education ? EDUCATION_LABEL[r.profile.education] : '学历未填' }} ·
                    {{ r.profile.cityName ?? '未填城市' }}
                  </div>
                  <div class="tags">
                    <el-tag v-for="h in r.highlights" :key="h" size="small" type="success" effect="plain">{{ h }}</el-tag>
                    <el-tag v-for="c in r.concerns" :key="c" size="small" type="warning" effect="plain">{{ c }}</el-tag>
                  </div>
                </div>
                <div class="score">
                  <div class="score-num" :style="{ color: scoreColor(r.score) }">{{ r.score }}</div>
                  <div class="text-muted">综合分</div>
                </div>
              </div>

              <div class="bidirectional">
                <div>
                  <span class="text-muted">TA 满足对方要求</span>
                  <el-progress :percentage="Math.round(r.aSatisfiesB * 100)" :stroke-width="8" />
                </div>
                <div>
                  <span class="text-muted">对方满足 TA 要求</span>
                  <el-progress :percentage="Math.round(r.bSatisfiesA * 100)" :stroke-width="8" color="#409eff" />
                </div>
              </div>

              <el-collapse>
                <el-collapse-item title="打分明细">
                  <el-table :data="r.details" size="small" border>
                    <el-table-column prop="label" label="维度" width="160" />
                    <el-table-column label="原始分" width="90">
                      <template #default="{ row }">{{ row.raw.toFixed(2) }}</template>
                    </el-table-column>
                    <el-table-column label="权重" width="80">
                      <template #default="{ row }">{{ row.weight.toFixed(2) }}</template>
                    </el-table-column>
                    <el-table-column label="加权" width="90">
                      <template #default="{ row }">{{ row.weighted.toFixed(3) }}</template>
                    </el-table-column>
                    <el-table-column prop="note" label="说明" min-width="160" />
                  </el-table>
                  <div v-if="r.aiReason" class="ai-reason">
                    <el-icon><MagicStick /></el-icon> AI 理由：{{ r.aiReason }}
                  </div>
                </el-collapse-item>
              </el-collapse>
            </div>
          </div>

          <div v-if="total > pageSize" class="pagination-bar">
            <el-pagination
              :current-page="page"
              :page-size="pageSize"
              :total="total"
              layout="total, prev, pager, next"
              background
              @current-change="(p: number) => { page = p; run(); }"
            />
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { MagicStick } from '@element-plus/icons-vue';
import {
  DEFAULT_MATCH_WEIGHTS,
  EDUCATION_LABEL,
  type MatchResultDto,
  type MatchWeightKey,
  type ProfileBriefDto,
} from '@yuanqiao/shared';
import { matchApi } from '@/api';
import DictTag from '@/components/DictTag.vue';
import ProfilePicker from '@/components/ProfilePicker.vue';
import RegionCascader from '@/components/RegionCascader.vue';

const profileId = ref('');
const target = ref<ProfileBriefDto>();
const cityCode = ref<string>();
const regionValue = ref<string[]>([]);
const minScore = ref(0);
const enableAi = ref(false);

const weightList = ref<{ key: MatchWeightKey; label: string; value: number }[]>([]);
const weights = reactive<Record<string, number>>({ ...DEFAULT_MATCH_WEIGHTS });
const weightSum = computed(() => Object.values(weights).reduce((a, b) => a + b, 0));

const loading = ref(false);
const results = ref<MatchResultDto[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 10;

function resetWeights(): void {
  Object.assign(weights, DEFAULT_MATCH_WEIGHTS);
}

function scoreColor(score: number): string {
  if (score >= 80) return '#67c23a';
  if (score >= 60) return '#e6a23c';
  return '#909399';
}

async function run(): Promise<void> {
  if (!profileId.value) return;
  loading.value = true;
  try {
    const res = await matchApi.preview({
      profileId: profileId.value,
      page: page.value,
      pageSize,
      enableAi: enableAi.value,
      weights: weights as Partial<Record<MatchWeightKey, number>>,
      cityCode: cityCode.value,
      minScore: minScore.value || undefined,
    });
    results.value = res.list;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  weightList.value = await matchApi.weights();
});
</script>

<style scoped>
.tip {
  margin-bottom: 12px;
}

.weight-row {
  margin-bottom: 6px;
}

.weight-label {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.hint {
  margin: 4px 0 12px;
  font-size: 12px;
}

.run-btn {
  width: 100%;
}

.result {
  padding: 14px;
  margin-bottom: 12px;
  border: 1px solid var(--yq-border);
  border-radius: 8px;
}

.result-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.result-info {
  flex: 1;
  font-size: 13px;
  line-height: 1.7;
}

.result-info .name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.score {
  text-align: center;
  font-size: 12px;
}

.score-num {
  font-size: 30px;
  font-weight: 700;
  line-height: 1;
}

.bidirectional {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin: 12px 0;
  font-size: 12px;
}

.ai-reason {
  margin-top: 10px;
  padding: 10px;
  background: var(--yq-primary-light);
  border-radius: 6px;
  line-height: 1.6;
}
</style>
