"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const schedule_1 = require("@nestjs/schedule");
const serve_static_1 = require("@nestjs/serve-static");
const node_path_1 = require("node:path");
const configuration_1 = __importDefault(require("./config/configuration"));
const all_exceptions_filter_1 = require("./common/filters/all-exceptions.filter");
const jwt_auth_guard_1 = require("./common/guards/jwt-auth.guard");
const permissions_guard_1 = require("./common/guards/permissions.guard");
const operation_log_interceptor_1 = require("./common/interceptors/operation-log.interceptor");
const transform_interceptor_1 = require("./common/interceptors/transform.interceptor");
const ai_module_1 = require("./infra/ai/ai.module");
const prisma_module_1 = require("./infra/prisma/prisma.module");
const redis_module_1 = require("./infra/redis/redis.module");
const storage_module_1 = require("./infra/storage/storage.module");
const auth_module_1 = require("./modules/auth/auth.module");
const dashboard_module_1 = require("./modules/dashboard/dashboard.module");
const health_controller_1 = require("./modules/health/health.controller");
const field_module_1 = require("./modules/field/field.module");
const match_module_1 = require("./modules/match/match.module");
const matchmaker_module_1 = require("./modules/matchmaker/matchmaker.module");
const privacy_module_1 = require("./modules/privacy/privacy.module");
const profile_module_1 = require("./modules/profile/profile.module");
const system_module_1 = require("./modules/system/system.module");
const tasks_module_1 = require("./modules/tasks/tasks.module");
const vip_module_1 = require("./modules/vip/vip.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                load: [configuration_1.default],
                // 根目录一份 .env，apps/server/.env 是指向它的软链
                envFilePath: ['.env', (0, node_path_1.join)(__dirname, '../../../.env')],
            }),
            schedule_1.ScheduleModule.forRoot(),
            // 上传的图片直接由 Node 提供访问。生产建议交给 Nginx（见 deploy/nginx.conf），
            // 这里保留是为了不装 Nginx 也能完整跑起来。
            serve_static_1.ServeStaticModule.forRoot({
                rootPath: (0, node_path_1.join)(process.cwd(), process.env.UPLOAD_DIR ?? './uploads'),
                serveRoot: '/uploads',
                serveStaticOptions: { index: false, maxAge: '7d' },
            }),
            // 基础设施
            prisma_module_1.PrismaModule,
            redis_module_1.RedisModule,
            storage_module_1.StorageModule,
            ai_module_1.AiModule,
            // 业务模块
            auth_module_1.AuthModule,
            field_module_1.FieldModule,
            privacy_module_1.PrivacyModule,
            profile_module_1.ProfileModule,
            match_module_1.MatchModule,
            matchmaker_module_1.MatchmakerModule,
            vip_module_1.VipModule,
            system_module_1.SystemModule,
            dashboard_module_1.DashboardModule,
            tasks_module_1.TasksModule,
        ],
        controllers: [health_controller_1.HealthController],
        providers: [
            // 顺序有意义：先鉴权，再校验权限
            { provide: core_1.APP_GUARD, useClass: jwt_auth_guard_1.JwtAuthGuard },
            { provide: core_1.APP_GUARD, useClass: permissions_guard_1.PermissionsGuard },
            { provide: core_1.APP_INTERCEPTOR, useClass: transform_interceptor_1.TransformInterceptor },
            { provide: core_1.APP_INTERCEPTOR, useClass: operation_log_interceptor_1.OperationLogInterceptor },
            { provide: core_1.APP_FILTER, useClass: all_exceptions_filter_1.AllExceptionsFilter },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map