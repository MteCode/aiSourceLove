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
var AiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const redis_service_1 = require("../redis/redis.service");
const ai_provider_1 = require("./ai.provider");
/**
 * AI 服务。对上层只暴露"要向量"和"要一句推荐理由"，
 * 上层不关心背后是 mock 还是 DeepSeek。
 *
 * 所有对外调用都带兜底：AI 挂了不能让匹配接口挂掉，
 * 降级为"没有 AI 层"，L1+L2 照常出结果。
 */
let AiService = AiService_1 = class AiService {
    config;
    redis;
    logger = new common_1.Logger(AiService_1.name);
    provider;
    constructor(config, redis) {
        this.config = config;
        this.redis = redis;
        const ai = this.config.get('ai', { infer: true });
        if (ai.provider === 'openai-compatible' && ai.embeddingApiKey) {
            this.provider = new ai_provider_1.OpenAiCompatProvider({
                chatBaseUrl: ai.baseUrl,
                chatApiKey: ai.apiKey,
                chatModel: ai.chatModel,
                embeddingBaseUrl: ai.embeddingBaseUrl || ai.baseUrl,
                embeddingApiKey: ai.embeddingApiKey || ai.apiKey,
                embeddingModel: ai.embeddingModel,
                embeddingDim: ai.embeddingDim,
            });
            this.logger.log(`AI Provider: openai-compatible (${ai.chatModel} / ${ai.embeddingModel})`);
        }
        else {
            this.provider = new ai_provider_1.MockAiProvider(256);
            this.logger.warn('AI Provider: mock（未配置 AI_API_KEY）。匹配的 AI 层会退化为词面重合度，L1+L2 不受影响。');
        }
    }
    get isReal() {
        return this.provider.isReal;
    }
    get providerName() {
        return this.provider.name;
    }
    /** 批量向量化，失败返回 null（调用方降级） */
    async embed(texts) {
        if (!texts.length)
            return [];
        try {
            return await this.provider.embed(texts);
        }
        catch (e) {
            this.logger.error(`向量化失败：${e.message}`);
            return null;
        }
    }
    async embedOne(text) {
        const r = await this.embed([text]);
        return r?.[0] ?? null;
    }
    /**
     * 生成推荐理由。带 Redis 缓存——同一对人的理由不会天天变，
     * 而且这是真金白银的 token 消耗。
     */
    async generateMatchReason(input) {
        const cached = await this.redis.get(`ai:reason:${input.cacheKey}`);
        if (cached)
            return cached;
        const messages = [
            {
                role: 'system',
                content: '你是一位经验丰富的婚恋红娘助理。根据两人的资料和系统算出的匹配点，' +
                    '写一句 40-80 字的中文推荐理由，给红娘和用户看。' +
                    '要求：具体、克制、不夸张、不承诺结果；只说资料里有的事实；不要用"完美""天作之合"这类词。',
            },
            {
                role: 'user',
                content: [
                    `综合匹配分：${input.score}/100`,
                    `会员A自述：${input.selfDesc.slice(0, 300) || '（未填写）'}`,
                    `会员B自述：${input.otherDesc.slice(0, 300) || '（未填写）'}`,
                    `系统识别的契合点：${input.highlights.join('、') || '无'}`,
                    `需要留意：${input.concerns.join('、') || '无'}`,
                ].join('\n'),
            },
        ];
        try {
            const text = await this.provider.chat(messages, { maxTokens: 200, temperature: 0.6 });
            if (text)
                await this.redis.set(`ai:reason:${input.cacheKey}`, text, 7 * 24 * 3600);
            return text || null;
        }
        catch (e) {
            this.logger.error(`生成推荐理由失败：${e.message}`);
            return null;
        }
    }
};
exports.AiService = AiService;
exports.AiService = AiService = AiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        redis_service_1.RedisService])
], AiService);
//# sourceMappingURL=ai.service.js.map