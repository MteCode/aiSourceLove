<template>
  <div class="page">
    <el-alert
      type="info"
      :closable="false"
      class="tip"
      title="动态字段字典"
      description="这里加一个字段，会员端录入表单立刻多一个输入框，不用发版。核心字段（isCore）映射到固定列可建索引；其余走 EAV 扩展表。"
    />

    <el-row :gutter="12">
      <el-col :xs="24" :md="6">
        <div class="page-card">
          <div class="table-toolbar">
            <span class="title">字段分组</span>
            <el-button v-perm="'field:edit'" link :icon="Plus" @click="openGroup()">新增</el-button>
          </div>
          <div v-loading="loading" class="groups">
            <div
              v-for="g in groups"
              :key="g.id"
              :class="['group-item', { active: currentGroup === g.id }]"
              @click="currentGroup = g.id"
            >
              <div>
                <div class="name">{{ g.name }}</div>
                <div class="mono text-muted">{{ g.code }} · {{ g.fields.length }} 个字段</div>
              </div>
              <div v-perm="'field:edit'" class="ops">
                <el-button link :icon="Edit" @click.stop="openGroup(g)" />
                <el-popconfirm title="分组下有字段时不能删，确定吗？" @confirm="removeGroup(g)">
                  <template #reference>
                    <el-button link type="danger" :icon="Delete" @click.stop />
                  </template>
                </el-popconfirm>
              </div>
            </div>
          </div>
        </div>
      </el-col>

      <el-col :xs="24" :md="18">
        <div class="page-card">
          <div class="table-toolbar">
            <span class="title">{{ activeGroup?.name ?? '字段' }} · 字段列表</span>
            <div>
              <el-button :icon="View" @click="previewVisible = true">表单预览</el-button>
              <el-button v-perm="'field:edit'" type="primary" :icon="Plus" :disabled="!currentGroup" @click="openField()">
                新增字段
              </el-button>
            </div>
          </div>

          <el-table :data="activeGroup?.fields ?? []" border stripe row-key="id">
            <el-table-column prop="sort" label="排序" width="70" align="center" />
            <el-table-column prop="label" label="名称" min-width="120" />
            <el-table-column prop="code" label="编码" min-width="130">
              <template #default="{ row }"><span class="mono">{{ row.code }}</span></template>
            </el-table-column>
            <el-table-column label="类型" width="110">
              <template #default="{ row }">
                <el-tag size="small" effect="plain">{{ FIELD_TYPE_LABEL[row.type] ?? row.type }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="必填" width="70" align="center">
              <template #default="{ row }">
                <el-icon v-if="row.required" class="text-danger"><Check /></el-icon>
                <span v-else class="text-muted">-</span>
              </template>
            </el-table-column>
            <el-table-column label="可见等级" width="110">
              <template #default="{ row }">{{ VISIBILITY_LABEL[row.visibility] }}</template>
            </el-table-column>
            <el-table-column label="属性" width="150">
              <template #default="{ row }">
                <el-tag v-if="row.isCore" size="small" type="warning">固定列</el-tag>
                <el-tag v-else size="small" type="info">扩展</el-tag>
                <el-tag v-if="row.isPreference" size="small" type="success">择偶</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="权重键" width="130">
              <template #default="{ row }">
                {{ row.weightKey ? MATCH_WEIGHT_LABEL[row.weightKey] : '-' }}
              </template>
            </el-table-column>
            <el-table-column label="启用" width="80" align="center">
              <template #default="{ row }">
                <el-switch
                  :model-value="row.enabled"
                  :disabled="!canEdit"
                  @change="(v) => toggleEnabled(row, v as boolean)"
                />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" align="center" fixed="right">
              <template #default="{ row }">
                <el-button v-perm="'field:edit'" link type="primary" @click="openField(row)">编辑</el-button>
                <el-popconfirm title="删除后已录入的数据会保留但不再展示，确定吗？" @confirm="removeField(row)">
                  <template #reference>
                    <el-button v-perm="'field:edit'" link type="danger">删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>

    <GroupDialog v-model="groupVisible" :group="editingGroup" @done="loadGroups" />
    <FieldDialog v-model="fieldVisible" :field="editingField" :group-id="currentGroup" :groups="groups" @done="loadGroups" />

    <el-drawer v-model="previewVisible" title="会员端表单预览" size="45%">
      <FormPreview :groups="groups" />
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Check, Delete, Edit, Plus, View } from '@element-plus/icons-vue';
import {
  MATCH_WEIGHT_LABEL,
  VISIBILITY_LABEL,
  type FieldDefDto,
  type FieldGroupDto,
} from '@yuanqiao/shared';
import { fieldApi } from '@/api';
import { FIELD_TYPE_LABEL } from './constants';
import { useUserStore } from '@/stores';
import FieldDialog from './components/FieldDialog.vue';
import FormPreview from './components/FormPreview.vue';
import GroupDialog from './components/GroupDialog.vue';


const user = useUserStore();
const canEdit = computed(() => user.can('field:edit'));

const loading = ref(false);
const groups = ref<FieldGroupDto[]>([]);
const currentGroup = ref('');

const activeGroup = computed(() => groups.value.find((g) => g.id === currentGroup.value));

const groupVisible = ref(false);
const editingGroup = ref<FieldGroupDto | null>(null);
const fieldVisible = ref(false);
const editingField = ref<FieldDefDto | null>(null);
const previewVisible = ref(false);

async function loadGroups(): Promise<void> {
  loading.value = true;
  try {
    groups.value = await fieldApi.groups();
  } finally {
    loading.value = false;
  }
}

watch(groups, (list) => {
  if (list.length && !list.some((g) => g.id === currentGroup.value)) {
    currentGroup.value = list[0].id;
  }
});

function openGroup(g?: FieldGroupDto): void {
  editingGroup.value = g ?? null;
  groupVisible.value = true;
}

function openField(f?: FieldDefDto): void {
  editingField.value = f ?? null;
  fieldVisible.value = true;
}

async function removeGroup(g: FieldGroupDto): Promise<void> {
  await fieldApi.removeGroup(g.id);
  ElMessage.success('已删除');
  void loadGroups();
}

async function removeField(f: FieldDefDto): Promise<void> {
  await fieldApi.remove(f.id);
  ElMessage.success('已删除');
  void loadGroups();
}

async function toggleEnabled(f: FieldDefDto, enabled: boolean): Promise<void> {
  await fieldApi.update(f.id, { enabled });
  ElMessage.success(enabled ? '已启用' : '已停用');
  void loadGroups();
}

onMounted(loadGroups);
</script>

<style scoped>
.tip {
  margin-bottom: 12px;
}

.group-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
}

.group-item:hover {
  background: var(--yq-bg);
}

.group-item.active {
  background: var(--yq-primary-light);
  border-color: var(--yq-primary);
}

.group-item .name {
  font-weight: 500;
}

.group-item .mono {
  font-size: 12px;
}

.ops {
  display: flex;
}
</style>
