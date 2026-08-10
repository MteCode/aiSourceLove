import { INestApplication, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
        ...(process.env.DEBUG_SQL === 'true'
          ? [{ emit: 'event' as const, level: 'query' as const }]
          : []),
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    // @ts-expect-error Prisma 的事件类型在 log 配置为动态数组时推不出来
    this.$on('warn', (e: Prisma.LogEvent) => this.logger.warn(e.message));
    // @ts-expect-error 同上
    this.$on('error', (e: Prisma.LogEvent) => this.logger.error(e.message));
    if (process.env.DEBUG_SQL === 'true') {
      // @ts-expect-error 同上
      this.$on('query', (e: Prisma.QueryEvent) => {
        this.logger.debug(`${e.duration}ms  ${e.query}`);
      });
    }

    await this.$connect();
    this.logger.log('数据库已连接');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** 优雅关闭：进程退出前先把连接放干净 */
  enableShutdownHooks(app: INestApplication): void {
    process.on('beforeExit', () => {
      void app.close();
    });
  }

  /**
   * 生成业务流水号（会员号 YQ…、牵线号 IN…、提现号 WD…）。
   *
   * 用 DB 自增而不是 Redis / 时间戳随机数：serialNo 会印在合同和转账备注上，
   * 绝对不能重复。这里靠行锁串行化，并发下也只会顺序发号。
   */
  async nextSerial(key: string, prefix: string, tx?: Prisma.TransactionClient): Promise<string> {
    const client = tx ?? this;
    // upsert + 原子自增，避免先查后写的竞态
    const row = await client.serialCounter.upsert({
      where: { key },
      create: { key, value: 1 },
      update: { value: { increment: 1 } },
    });
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${prefix}${yy}${mm}${dd}${String(row.value).padStart(5, '0')}`;
  }
}
