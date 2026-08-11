import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { RedisService } from '@/infra/redis/redis.service';
import { CommissionService } from '@/modules/matchmaker/commission.service';
import { SystemService } from '@/modules/system/system.service';
import { OrderService } from '@/modules/vip/order.service';
import { ReconcileService } from '@/modules/vip/reconcile.service';

/**
 * 定时任务。
 *
 * 每个任务都加了分布式锁：多实例部署时（pm2 cluster / 多台机器）
 * 不加锁会出现"同一笔分润结算两次"这种事故。
 */
@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly order: OrderService,
    private readonly commission: CommissionService,
    private readonly reconcile: ReconcileService,
    private readonly system: SystemService,
  ) {}

  /** 带锁执行，拿不到锁说明别的实例在跑，直接跳过 */
  private async withLock(name: string, ttl: number, fn: () => Promise<void>): Promise<void> {
    const release = await this.redis.acquireLock(`cron:${name}`, ttl);
    if (!release) {
      this.logger.debug(`任务 ${name} 已被其它实例执行，跳过`);
      return;
    }
    try {
      await fn();
    } catch (e) {
      this.logger.error(`任务 ${name} 执行失败：${(e as Error).message}`, (e as Error).stack);
    } finally {
      await release();
    }
  }

  /** 每 5 分钟：关闭超时未支付订单 */
  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'closeExpiredOrders' })
  async closeExpiredOrders(): Promise<void> {
    await this.withLock('closeExpiredOrders', 120, async () => {
      await this.order.closeExpired();
    });
  }

  /** 每小时：处理 VIP 到期、置顶到期 */
  @Cron(CronExpression.EVERY_HOUR, { name: 'expireVipAndTop' })
  async expireVipAndTop(): Promise<void> {
    await this.withLock('expireVipAndTop', 300, async () => {
      await this.order.expireVips();

      const r = await this.prisma.profile.updateMany({
        where: { isTop: true, topExpireAt: { lt: new Date() } },
        data: { isTop: false },
      });
      if (r.count) this.logger.log(`${r.count} 个档案的置顶曝光到期`);
    });
  }

  /** 每天 01:00：结算过了冷静期的分润 */
  @Cron('0 0 1 * * *', { name: 'settleCommissions', timeZone: 'Asia/Shanghai' })
  async settleCommissions(): Promise<void> {
    await this.withLock('settleCommissions', 600, async () => {
      await this.commission.settleDue();
    });
  }

  /**
   * 每天 02:00：对昨天的账。
   * 时间选在 02:00 是因为微信支付的对账单一般 T+1 的凌晨才出全。
   */
  @Cron('0 0 2 * * *', { name: 'dailyReconcile', timeZone: 'Asia/Shanghai' })
  async dailyReconcile(): Promise<void> {
    await this.withLock('dailyReconcile', 900, async () => {
      const r = await this.reconcile.reconcile();
      if (r.result !== 'MATCHED') {
        // 生产环境这里应该接告警（钉钉/企微/短信），不能只写日志
        this.logger.error(`【需人工处理】${r.date} 对账未平：${r.result}，差异 ${r.diffs.length} 条`);
      }
    });
  }

  /** 每天 03:00：清理 90 天前的操作日志 */
  @Cron('0 0 3 * * *', { name: 'pruneLogs', timeZone: 'Asia/Shanghai' })
  async pruneLogs(): Promise<void> {
    await this.withLock('pruneLogs', 600, async () => {
      const n = await this.system.pruneLogs(90);
      if (n) this.logger.log(`清理了 ${n} 条历史操作日志`);
    });
  }
}
