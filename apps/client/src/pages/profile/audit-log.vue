<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { PROFILE_STATUS_LABEL, type AuditLogDto } from '@yuanqiao/shared';
import { profileApi } from '@/api';
import { formatDate } from '@/utils/format';

const logs = ref<AuditLogDto[]>([]);

onShow(async () => {
  logs.value = await profileApi.myAuditLogs();
});
</script>

<template>
  <view class="yq-page">
    <view class="yq-card">
      <yq-empty v-if="!logs.length" icon="📋" text="还没有审核记录" />
      <view v-for="log in logs" :key="log.id" class="item">
        <view class="dot" />
        <view class="content">
          <text class="line">
            {{ log.fromStatus ? PROFILE_STATUS_LABEL[log.fromStatus] : '创建' }} →
            <text class="strong">{{ PROFILE_STATUS_LABEL[log.toStatus] }}</text>
          </text>
          <text v-if="log.reason" class="reason yq-danger">{{ log.reason }}</text>
          <text class="time yq-muted">{{ formatDate(log.createdAt, true) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.item {
  display: flex;
  padding: 20rpx 0;
}

.dot {
  width: 16rpx;
  height: 16rpx;
  margin: 12rpx 20rpx 0 0;
  background: $yq-primary;
  border-radius: 50%;
  flex-shrink: 0;
}

.line {
  font-size: 28rpx;
}

.strong {
  font-weight: 600;
}

.reason,
.time {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.6;
}
</style>
