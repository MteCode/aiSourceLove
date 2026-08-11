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
var PayProviderRegistry_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayProviderRegistry = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const shared_1 = require("@yuanqiao/shared");
const pay_provider_1 = require("./pay.provider");
/**
 * 支付通道注册表。
 * 按 .env 里的 PAY_PROVIDER 决定默认通道，同时保留按订单指定通道的能力
 * （同一个系统里可能小程序走微信、H5 走支付宝）。
 */
let PayProviderRegistry = PayProviderRegistry_1 = class PayProviderRegistry {
    config;
    logger = new common_1.Logger(PayProviderRegistry_1.name);
    providers = new Map();
    defaultChannel;
    baseUrl;
    constructor(config) {
        this.config = config;
        const payCfg = this.config.get('pay', { infer: true });
        this.baseUrl = this.config.get('publicBaseUrl', { infer: true });
        // mock 通道永远注册着，方便随时用它验链路
        this.providers.set(shared_1.PayChannel.MOCK, new pay_provider_1.MockPayProvider(this.baseUrl));
        if (payCfg.provider === 'wechat') {
            this.providers.set(shared_1.PayChannel.WECHAT, new pay_provider_1.WechatPayProvider(payCfg.wechat));
            this.defaultChannel = shared_1.PayChannel.WECHAT;
            this.logger.log('默认支付通道：微信支付');
        }
        else {
            this.defaultChannel = shared_1.PayChannel.MOCK;
            this.logger.warn('默认支付通道：MOCK（模拟支付）。这个通道不会真实收款，仅用于开发和演示，' +
                '上线前务必把 PAY_PROVIDER 改成 wechat 并完成 WechatPayProvider 的接入。');
        }
    }
    get(channel) {
        const key = channel ?? this.defaultChannel;
        const p = this.providers.get(key);
        if (!p) {
            throw new Error(`支付通道 ${key} 未配置。可用：${[...this.providers.keys()].join(', ')}`);
        }
        return p;
    }
    get isMockOnly() {
        return this.defaultChannel === shared_1.PayChannel.MOCK;
    }
    notifyUrl(channel) {
        return `${this.baseUrl}/api/pay/notify/${channel.toLowerCase()}`;
    }
};
exports.PayProviderRegistry = PayProviderRegistry;
exports.PayProviderRegistry = PayProviderRegistry = PayProviderRegistry_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], PayProviderRegistry);
//# sourceMappingURL=pay.registry.js.map