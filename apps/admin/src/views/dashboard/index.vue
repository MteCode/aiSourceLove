<template>
  <div class="page" v-loading="loading">
    <el-row :gutter="12">
      <el-col v-for="s in stats" :key="s.label" :xs="12" :sm="8" :md="6" class="stat-col">
        <StatCard v-bind="s" />
      </el-col>
    </el-row>

    <el-row :gutter="12" class="row">
      <el-col :xs="24" :lg="16">
        <div class="page-card">
          <div class="table-toolbar"><span class="title">近 30 天趋势</span></div>
          <EChart :option="trendOption" height="330px" />
        </div>
      </el-col>
      <el-col :xs="24" :lg="8">
        <div class="page-card">
          <div class="table-toolbar"><span class="title">男女比例</span></div>
          <EChart :option="genderOption" height="150px" />
          <el-divider />
          <div class="table-toolbar"><span class="title">待处理</span></div>
          <div class="todo">
            <div class="todo-item" @click="$router.push('/member/audit')">
              <span>资料待审核</span>
              <el-tag :type="data?.pendingAudit ? 'warning' : 'info'">{{ data?.pendingAudit ?? 0 }}</el-tag>
            </div>
            <div class="todo-item" @click="$router.push('/member/photo-audit')">
              <span>照片待审核</span>
              <el-tag :type="data?.pendingPhotoAudit ? 'warning' : 'info'">
                {{ data?.pendingPhotoAudit ?? 0 }}
              </el-tag>
            </div>
            <div class="todo-item" @click="$router.push('/matchmaker/withdrawals')">
              <span>进行中的牵线</span>
              <el-tag type="primary">{{ data?.activeIntroductions ?? 0 }}</el-tag>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <div class="page-card row">
      <div class="table-toolbar"><span class="title">城市分布 Top 10</span></div>
      <EChart :option="cityOption" height="300px" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { EChartsOption } from 'echarts';
import type { DashboardDto } from '@yuanqiao/shared';
import { dashboardApi } from '@/api';
import EChart from '@/components/EChart.vue';
import StatCard from '@/components/StatCard.vue';
import { fen2yuan } from '@/utils/format';

const loading = ref(false);
const data = ref<DashboardDto | null>(null);

const stats = computed(() => {
  const d = data.value;
  return [
    { label: '会员总数', value: d?.totalMembers ?? 0, icon: 'User', color: '#e05a7d', sub: `今日新增 ${d?.newMembersToday ?? 0}` },
    { label: '待审资料', value: d?.pendingAudit ?? 0, icon: 'Stamp', color: '#e6a23c', sub: `待审照片 ${d?.pendingPhotoAudit ?? 0}` },
    { label: '红娘数', value: d?.totalMatchmakers ?? 0, icon: 'Avatar', color: '#409eff', sub: `牵线成功 ${d?.successIntroductions ?? 0}` },
    { label: 'VIP 会员', value: d?.vipCount ?? 0, icon: 'Present', color: '#67c23a', sub: '当前有效' },
    { label: '今日营收', value: fen2yuan(d?.revenueToday), unit: '元', icon: 'Money', color: '#f56c6c' },
    { label: '本月营收', value: fen2yuan(d?.revenueThisMonth), unit: '元', icon: 'TrendCharts', color: '#9254de' },
    { label: '累计营收', value: fen2yuan(d?.revenueTotal), unit: '元', icon: 'Coin', color: '#13c2c2' },
    { label: '进行中牵线', value: d?.activeIntroductions ?? 0, icon: 'Link', color: '#fa8c16' },
  ];
});

const trendOption = computed<EChartsOption>(() => {
  const trend = data.value?.trend ?? [];
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['新增会员', '牵线数', '营收(元)'] },
    grid: { left: 40, right: 50, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: trend.map((t) => t.date.slice(5)) },
    // 营收和人数量级差太多，必须双轴，否则人数被压成一条直线
    yAxis: [
      { type: 'value', name: '人 / 单' },
      { type: 'value', name: '元' },
    ],
    series: [
      { name: '新增会员', type: 'line', smooth: true, data: trend.map((t) => t.newMembers), itemStyle: { color: '#e05a7d' } },
      { name: '牵线数', type: 'line', smooth: true, data: trend.map((t) => t.introductions), itemStyle: { color: '#409eff' } },
      {
        name: '营收(元)',
        type: 'bar',
        yAxisIndex: 1,
        data: trend.map((t) => Number(fen2yuan(t.revenue))),
        itemStyle: { color: '#67c23a', opacity: 0.55 },
      },
    ],
  };
});

const genderOption = computed<EChartsOption>(() => {
  const g = data.value?.genderRatio ?? { male: 0, female: 0 };
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        label: { formatter: '{b} {d}%' },
        data: [
          { name: '男', value: g.male, itemStyle: { color: '#409eff' } },
          { name: '女', value: g.female, itemStyle: { color: '#e05a7d' } },
        ],
      },
    ],
  };
});

const cityOption = computed<EChartsOption>(() => {
  const cities = data.value?.cityDistribution ?? [];
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 70, right: 30, top: 20, bottom: 30 },
    xAxis: { type: 'value' },
    // 倒序：条形图从上往下画，不反转的话第一名会跑到最底下
    yAxis: { type: 'category', data: cities.map((c) => c.cityName).reverse() },
    series: [
      {
        type: 'bar',
        data: cities.map((c) => c.count).reverse(),
        itemStyle: { color: '#e05a7d', borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right' },
      },
    ],
  };
});

onMounted(async () => {
  loading.value = true;
  try {
    data.value = await dashboardApi.overview();
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.stat-col {
  margin-bottom: 12px;
}

.row {
  margin-top: 0;
}

.todo-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 4px;
  cursor: pointer;
  border-bottom: 1px solid var(--yq-border);
}

.todo-item:hover {
  color: var(--yq-primary);
}

.todo-item:last-child {
  border-bottom: none;
}
</style>
