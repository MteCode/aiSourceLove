# 缘桥 — 相亲 / 婚恋撮合平台

Monorepo，三块：共享契约、NestJS 后端、Vue3 后台管理端。

```
packages/shared   前后端共享的枚举、中文标签、类型契约、状态机、隐私分级
apps/server       NestJS + Prisma + MySQL + Redis
apps/admin        Vue3 + Vite + Element Plus 后台管理端
apps/client       uni-app + Vue3 会员端（微信小程序 / H5）
deploy            Nginx 配置与部署脚本
```

## 六大模块

| 模块 | 说明 |
|---|---|
| 录入系统 | 动态字段字典驱动的表单，后台加字段不用发版；档案审核走状态机，照片独立审核 |
| AI 匹配 | L1 SQL 硬过滤 → L2 双向加权打分 → L3 AI 语义。每一维的得分都可解释，红娘不信任黑盒 |
| 红娘系统 | 入驻审核、代录档案、牵线工单（9 状态机）、分润（含冷静期）、提现审核 |
| 隐私分级 | 6 级可见性，字段按等级投影；VIP 拿到的是解锁次数而非全部解锁——这是复购的关键 |
| VIP 充值 | 套餐权益按次数/天数配置，微信支付 + mock 通道，退款会回收权益并冲销分润 |
| 后台管理 | RBAC 到按钮级、数据看板、操作日志、支付对账 |

## 本地启动

前置：Node ≥ 20、Docker（或本机已有 MySQL 8 + Redis）。

```bash
npm install
cp .env.example .env
```

**1. 起基础设施**

```bash
npm run infra:up
```

**2. 建表 + 灌种子数据**

```bash
npm run build:shared && npm run db:push && npm run db:seed
```

种子会建好 20 个权限点、5 个角色、行政区划、字段字典、VIP 套餐和演示数据。
超管账号默认 `admin / Admin@123456`（可用 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 覆盖）。
只要基础数据不要演示数据：`SEED_DEMO=false npm run db:seed`。

**3. 起服务**

```bash
npm run dev:server   # http://localhost:3000/api ，文档 /api/docs
npm run dev:admin    # http://localhost:5173
npm run dev:client   # H5 会员端 http://localhost:5174
npm run dev:mp       # 微信小程序，产物导入微信开发者工具
```

两个前端都统一请求相对路径 `/api`，开发期由各自的 Vite 代理转到后端，
所以不需要配后端绝对地址，也不会有跨域问题。小程序端没有跨域概念但也没有相对路径，
真机调试时要把 `apps/client/.env.development` 的 `VITE_API_BASE` 改成后端可访问的绝对地址。

微信小程序还需要：在 `apps/client/src/manifest.json` 填 `mp-weixin.appid`，
在 `.env` 填 `WX_MINI_APP_ID` / `WX_MINI_APP_SECRET`，
然后用微信开发者工具导入 `apps/client/dist/dev/mp-weixin`。

## 常用命令

```bash
npm run typecheck        # 四个包全量类型检查
npm run build            # shared → server → admin → client(H5) 依次构建
npm run build:mp         # 单独打微信小程序包
npm run db:migrate       # 生成并应用迁移（生产用这个，不要用 db:push）
npm run infra:logs       # 看容器日志
```

## 部署

`deploy/deploy.sh` 会构建各个包并安装 Nginx 配置：后台管理端由 Nginx 发静态文件（根路径），
会员端 H5 挂在 `/h5/`，
`/api` 反代到 3000 端口的 Node 进程，`/uploads` 直接由 Nginx 发（不占 Node 的事件循环）。
小程序上线必须 HTTPS，域名就绪后用 certbot 签证书，细节见 `deploy/nginx.conf` 末尾注释。

## 约定

- 所有接口返回统一信封 `{ code, message, data, traceId }`，`code === 0` 为成功
- 金额一律以「分」为单位存储和传输，展示层才转元
- 枚举值在 `packages/shared/src/enums.ts` 与 `schema.prisma` 中必须逐字一致
- 中文标签只在 `packages/shared/src/constants.ts` 维护一处，前后端共用
- 状态流转必须过状态机校验，不允许随手 update 状态字段
- 脱敏必须在服务端完成，没权限的字段下发的是 `MaskedValue` 而不是原始值
