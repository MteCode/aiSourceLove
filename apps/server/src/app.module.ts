import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import configuration from './config/configuration';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { OperationLogInterceptor } from './common/interceptors/operation-log.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AiModule } from './infra/ai/ai.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';
import { StorageModule } from './infra/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthController } from './modules/health/health.controller';
import { FieldModule } from './modules/field/field.module';
import { MatchModule } from './modules/match/match.module';
import { MatchmakerModule } from './modules/matchmaker/matchmaker.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { ProfileModule } from './modules/profile/profile.module';
import { SystemModule } from './modules/system/system.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { VipModule } from './modules/vip/vip.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // 根目录一份 .env，apps/server/.env 是指向它的软链
      envFilePath: ['.env', join(__dirname, '../../../.env')],
    }),
    ScheduleModule.forRoot(),

    // 上传的图片直接由 Node 提供访问。生产建议交给 Nginx（见 deploy/nginx.conf），
    // 这里保留是为了不装 Nginx 也能完整跑起来。
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), process.env.UPLOAD_DIR ?? './uploads'),
      serveRoot: '/uploads',
      serveStaticOptions: { index: false, maxAge: '7d' },
    }),

    // 基础设施
    PrismaModule,
    RedisModule,
    StorageModule,
    AiModule,

    // 业务模块
    AuthModule,
    FieldModule,
    PrivacyModule,
    ProfileModule,
    MatchModule,
    MatchmakerModule,
    VipModule,
    SystemModule,
    DashboardModule,
    TasksModule,
  ],
  controllers: [HealthController],
  providers: [
    // 顺序有意义：先鉴权，再校验权限
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: OperationLogInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
