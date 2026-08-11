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
var PrismaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
let PrismaService = PrismaService_1 = class PrismaService extends client_1.PrismaClient {
    logger = new common_1.Logger(PrismaService_1.name);
    constructor() {
        super({
            log: [
                { emit: 'event', level: 'warn' },
                { emit: 'event', level: 'error' },
                ...(process.env.DEBUG_SQL === 'true'
                    ? [{ emit: 'event', level: 'query' }]
                    : []),
            ],
        });
    }
    async onModuleInit() {
        // @ts-expect-error Prisma 的事件类型在 log 配置为动态数组时推不出来
        this.$on('warn', (e) => this.logger.warn(e.message));
        // @ts-expect-error 同上
        this.$on('error', (e) => this.logger.error(e.message));
        if (process.env.DEBUG_SQL === 'true') {
            // @ts-expect-error 同上
            this.$on('query', (e) => {
                this.logger.debug(`${e.duration}ms  ${e.query}`);
            });
        }
        await this.$connect();
        this.logger.log('数据库已连接');
    }
    async onModuleDestroy() {
        await this.$disconnect();
    }
    /** 优雅关闭：进程退出前先把连接放干净 */
    enableShutdownHooks(app) {
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
    async nextSerial(key, prefix, tx) {
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
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = PrismaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], PrismaService);
//# sourceMappingURL=prisma.service.js.map