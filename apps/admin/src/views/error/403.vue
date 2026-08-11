<template>
  <el-result icon="warning" title="403" sub-title="你没有访问该页面的权限，请联系管理员开通">
    <template #extra>
      <el-button type="primary" @click="$router.replace('/')">回到首页</el-button>
    </template>
  </el-result>
</template>
