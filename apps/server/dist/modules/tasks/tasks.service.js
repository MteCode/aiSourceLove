"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var TasksService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TasksService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const redis_service_1 = require("../../infra/redis/redis.service");
const commission_service_1 = require("../matchmaker/commission.service");
const system_service_1 = require("../system/system.service");
const order_service_1 = require("../vip/order.service");
const reconcile_service_1 = require("../vip/reconcile.service");
/**
 * 定时任务。
 *
 * 每个任务都加了分布式锁：多实例部署时（pm2 cluster / 多台机器）
 * 不加锁会出现"同一笔分润结算两次"这种事故。
 */
let TasksService = TasksService_1 = class TasksService {
    prisma;
    redis;
    order;
    commission;
    reconcile;
    system;
    logger = new common_1.Logger(TasksService_1.name);
    constructor(prisma, redis, order, commission, reconcile, system) {
        this.prisma = prisma;
        this.redis = redis;
        this.order = order;
        this.commission = commission;
        this.reconcile = reconcile;
        this.system = system;
    }
    /** 带锁执行，拿不到锁说明别的实例在跑，直接跳过 */
    async withLock(name, ttl, fn) {
        const release = await this.redis.acquireLock(`cron:${name}`, ttl);
        if (!release) {
            this.logger.debug(`任务 ${name} 已被其它实例执行，跳过`);
            return;
        }
        try {
            await fn();
        }
        catch (e) {
            this.logger.error(`任务 ${name} 执行失败：${e.message}`, e.stack);
        }
        finally {
            await release();
        }
    }
    /** 每 5 分钟：关闭超时未支付订单 */
    async closeExpiredOrders() {
        await this.withLock('closeExpiredOrders', 120, async () => {
            await this.order.closeExpired();
        });
    }
    /** 每小时：处理 VIP 到期、置顶到期 */
    async expireVipAndTop() {
        await this.withLock('expireVipAndTop', 300, async () => {
            await this.order.expireVips();
            const r = await this.prisma.profile.updateMany({
                where: { isTop: true, topExpireAt: { lt: new Date() } },
                data: { isTop: false },
            });
            if (r.count)
                this.logger.log(`${r.count} 个档案的置顶曝光到期`);
        });
    }
    /** 每天 01:00：结算过了冷静期的分润 */
    async settleCommissions() {
        await this.withLock('settleCommissions', 600, async () => {
            await this.commission.settleDue();
        });
    }
    /**
     * 每天 02:00：对昨天的账。
     * 时间选在 02:00 是因为微信支付的对账单一般 T+1 的凌晨才出全。
     */
    async dailyReconcile() {
        await this.withLock('dailyReconcile', 900, async () => {
            const r = await this.reconcile.reconcile();
            if (r.result !== 'MATCHED') {
                // 生产环境这里应该接告警（钉钉/企微/短信），不能只写日志
                this.logger.error(`【需人工处理】${r.date} 对账未平：${r.result}，差异 ${r.diffs.length} 条`);
            }
        });
    }
    /** 每天 03:00：清理 90 天前的操作日志 */
    async pruneLogs() {
        await this.withLock('pruneLogs', 600, async () => {
            const n = await this.system.pruneLogs(90);
            if (n)
                this.logger.log(`清理了 ${n} 条历史操作日志`);
        });
    }
};
exports.TasksService = TasksService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_5_MINUTES, { name: 'closeExpiredOrders' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TasksService.prototype, "closeExpiredOrders", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR, { name: 'expireVipAndTop' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TasksService.prototype, "expireVipAndTop", null);
__decorate([
    (0, schedule_1.Cron)('0 0 1 * * *', { name: 'settleCommissions', timeZone: 'Asia/Shanghai' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TasksService.prototype, "settleCommissions", null);
__decorate([
    (0, schedule_1.Cron)('0 0 2 * * *', { name: 'dailyReconcile', timeZone: 'Asia/Shanghai' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TasksService.prototype, "dailyReconcile", null);
__decorate([
    (0, schedule_1.Cron)('0 0 3 * * *', { name: 'pruneLogs', timeZone: 'Asia/Shanghai' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TasksService.prototype, "pruneLogs", null);
exports.TasksService = TasksService = TasksService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        order_service_1.OrderService,
        commission_service_1.CommissionService,
        reconcile_service_1.ReconcileService,
        system_service_1.SystemService])
], TasksService);
//# sourceMappingURL=tasks.service.js.map