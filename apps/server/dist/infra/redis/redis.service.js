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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var RedisService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
/**
 * Redis 封装。
 *
 * 这个系统里 Redis 只做三件事，不做持久化数据存储：
 *   1. 短信验证码（有 TTL，丢了重发就行）
 *   2. 分布式锁（支付回调、权益核销的并发保护）
 *   3. 缓存（表单 schema、AI 推荐理由）
 *
 * 如果 Redis 挂了，业务应该降级而不是全站 500——所以这里所有方法都吞异常并记日志。
 */
let RedisService = RedisService_1 = class RedisService {
    config;
    logger = new common_1.Logger(RedisService_1.name);
    client;
    available = false;
    constructor(config) {
        this.config = config;
    }
    onModuleInit() {
        const cfg = this.config.get('redis', { infer: true });
        this.client = new ioredis_1.default({
            host: cfg.host,
            port: cfg.port,
            password: cfg.password,
            db: cfg.db,
            lazyConnect: false,
            maxRetriesPerRequest: 2,
            retryStrategy: (times) => Math.min(times * 500, 5000),
        });
        this.client.on('ready', () => {
            this.available = true;
            this.logger.log('Redis 已连接');
        });
        this.client.on('error', (err) => {
            if (this.available)
                this.logger.error(`Redis 错误：${err.message}`);
            this.available = false;
        });
    }
    async onModuleDestroy() {
        await this.client?.quit().catch(() => undefined);
    }
    get raw() {
        return this.client;
    }
    get isAvailable() {
        return this.available;
    }
    async get(key) {
        try {
            return await this.client.get(key);
        }
        catch (e) {
            this.logger.warn(`Redis GET ${key} 失败：${e.message}`);
            return null;
        }
    }
    async set(key, value, ttlSeconds) {
        try {
            if (ttlSeconds)
                await this.client.set(key, value, 'EX', ttlSeconds);
            else
                await this.client.set(key, value);
            return true;
        }
        catch (e) {
            this.logger.warn(`Redis SET ${key} 失败：${e.message}`);
            return false;
        }
    }
    async del(...keys) {
        try {
            if (keys.length)
                await this.client.del(...keys);
        }
        catch (e) {
            this.logger.warn(`Redis DEL 失败：${e.message}`);
        }
    }
    /** 剩余 TTL，秒；-2 表示 key 不存在 */
    async ttl(key) {
        try {
            return await this.client.ttl(key);
        }
        catch {
            return -2;
        }
    }
    async incr(key, ttlSeconds) {
        try {
            const v = await this.client.incr(key);
            if (v === 1 && ttlSeconds)
                await this.client.expire(key, ttlSeconds);
            return v;
        }
        catch {
            return 0;
        }
    }
    async getJson(key) {
        const raw = await this.get(key);
        if (!raw)
            return null;
        try {
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    async setJson(key, value, ttlSeconds) {
        return this.set(key, JSON.stringify(value), ttlSeconds);
    }
    /**
     * 简易分布式锁。返回 release 函数，拿不到锁返回 null。
     *
     * 注意：这是"够用"级别的锁，不是 Redlock。资金相关的强一致性
     * 仍然靠 DB 唯一约束 + 事务兜底（见 PaymentTxn.transactionId 唯一键），
     * 这个锁只是减少无谓的并发冲突。
     */
    async acquireLock(key, ttlSeconds = 10) {
        const lockKey = `lock:${key}`;
        const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        try {
            const ok = await this.client.set(lockKey, token, 'EX', ttlSeconds, 'NX');
            if (ok !== 'OK')
                return null;
            return async () => {
                // 只删自己持有的锁，避免误删别人的
                const script = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
                await this.client.eval(script, 1, lockKey, token).catch(() => undefined);
            };
        }
        catch (e) {
            this.logger.warn(`获取锁 ${key} 失败：${e.message}`);
            // Redis 不可用时不阻塞业务，返回一个空 release
            return async () => undefined;
        }
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = RedisService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], RedisService);
//# sourceMappingURL=redis.service.js.map