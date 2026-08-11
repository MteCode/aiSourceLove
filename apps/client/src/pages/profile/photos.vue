<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { AUDIT_STATUS_LABEL, type PhotoDto } from '@yuanqiao/shared';
import { profileApi } from '@/api';
import { confirm, hideLoading, loading, toast } from '@/utils/ui';

const photos = ref<PhotoDto[]>([]);
const uploading = ref(false);

async function load(): Promise<void> {
  loading();
  try {
    const p = await profileApi.me();
    photos.value = p?.photos ?? [];
  } finally {
    hideLoading();
  }
}

function pick(): void {
  if (photos.value.length >= 9) {
    toast('最多上传 9 张');
    return;
  }
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const path = (res.tempFilePaths as string[])[0];
      if (!path) return;
      uploading.value = true;
      loading('上传中');
      try {
        // 首张自动设为主图，省一次操作
        await profileApi.uploadPhoto(path, photos.value.length === 0);
        toast('已上传，等待审核', 'success');
        await load();
      } finally {
        uploading.value = false;
        hideLoading();
      }
    },
  });
}

async function remove(p: PhotoDto): Promise<void> {
  if (!(await confirm('确定删除这张照片吗？'))) return;
  await profileApi.deletePhoto(p.id);
  toast('已删除');
  await load();
}

async function setPrimary(p: PhotoDto): Promise<void> {
  if (p.isPrimary) return;
  await profileApi.setPrimaryPhoto(p.id);
  toast('已设为主图');
  await load();
}

function preview(url: string): void {
  uni.previewImage({ urls: photos.value.map((p) => p.url), current: url });
}

function tagType(status: string): 'success' | 'warning' | 'danger' {
  if (status === 'APPROVED') return 'success';
  if (status === 'REJECTED') return 'danger';
  return 'warning';
}
</script>

<template>
  <view class="yq-page">
    <view class="yq-card tip">
      <text class="yq-muted">
        照片单独审核，一张不通过不会影响整份资料。真人正脸照通过率最高，
        含微信号/电话的图会被驳回。未解锁的人看到的是模糊处理后的版本。
      </text>
    </view>

    <view class="yq-card">
      <view class="grid">
        <view v-for="p in photos" :key="p.id" class="item">
          <image class="img" :src="p.url" mode="aspectFill" @tap="preview(p.url)" />
          <view class="badges">
            <yq-tag v-if="p.isPrimary" type="danger">主图</yq-tag>
            <yq-tag :type="tagType(p.auditStatus)">{{ AUDIT_STATUS_LABEL[p.auditStatus] }}</yq-tag>
          </view>
          <view class="ops">
            <text class="op" @tap="setPrimary(p)">{{ p.isPrimary ? '已是主图' : '设为主图' }}</text>
            <text class="op op--danger" @tap="remove(p)">删除</text>
          </view>
        </view>

        <view v-if="photos.length < 9" class="item add" @tap="pick">
          <text class="plus">+</text>
          <text class="add-text">上传照片</text>
        </view>
      </view>

      <yq-empty v-if="!photos.length && !uploading" icon="📷" text="还没有照片，有照片的资料被查看率高 3 倍" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.tip {
  font-size: 24rpx;
  line-height: 1.7;
}

.grid {
  display: flex;
  flex-wrap: wrap;
}

.item {
  width: 210rpx;
  margin: 0 16rpx 20rpx 0;
}

.item:nth-child(3n) {
  margin-right: 0;
}

.img {
  width: 210rpx;
  height: 210rpx;
  border-radius: 12rpx;
  background: $yq-bg;
}

.badges {
  display: flex;
  flex-wrap: wrap;
  margin-top: 8rpx;
}

.ops {
  display: flex;
  justify-content: space-between;
  margin-top: 4rpx;
  font-size: 22rpx;
}

.op {
  color: $yq-primary;
}

.op--danger {
  color: $yq-danger;
}

.add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 210rpx;
  height: 210rpx;
  background: $yq-bg;
  border: 2rpx dashed #dcdfe6;
  border-radius: 12rpx;
  box-sizing: border-box;
}

.plus {
  color: $yq-text-secondary;
  font-size: 60rpx;
  line-height: 1;
}

.add-text {
  margin-top: 8rpx;
  color: $yq-text-secondary;
  font-size: 22rpx;
}
</style>
