import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { RedisService } from '@/infra/redis/redis.service';

@ApiTags('健康检查')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * 给 Nginx / 容器编排 / 监控用。
   * DB 不通就返回 degraded —— 这时候进程活着但没法干活，
   * 只看进程存活的健康检查会漏掉这种"假活"。
   */
  @Public()
  @Get()
  @ApiOperation({ summary: '健康检查' })
  async check() {
    const db = await this.prisma
      .$queryRaw`SELECT 1`
      .then(() => true)
      .catch(() => false);

    return {
      status: db ? 'ok' : 'degraded',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      services: {
        database: db ? 'up' : 'down',
        redis: this.redis.isAvailable ? 'up' : 'down',
      },
    };
  }
}
