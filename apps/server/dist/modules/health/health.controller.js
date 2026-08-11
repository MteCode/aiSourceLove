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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../../common/decorators");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const redis_service_1 = require("../../infra/redis/redis.service");
let HealthController = class HealthController {
    prisma;
    redis;
    constructor(prisma, redis) {
        this.prisma = prisma;
        this.redis = redis;
    }
    /**
     * 给 Nginx / 容器编排 / 监控用。
     * DB 不通就返回 degraded —— 这时候进程活着但没法干活，
     * 只看进程存活的健康检查会漏掉这种"假活"。
     */
    async check() {
        const db = await this.prisma
            .$queryRaw `SELECT 1`
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
};
exports.HealthController = HealthController;
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: '健康检查' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "check", null);
exports.HealthController = HealthController = __decorate([
    (0, swagger_1.ApiTags)('健康检查'),
    (0, common_1.Controller)('health'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService])
], HealthController);
//# sourceMappingURL=health.controller.js.map