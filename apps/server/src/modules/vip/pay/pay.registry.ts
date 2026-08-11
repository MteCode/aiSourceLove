import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayChannel } from '@yuanqiao/shared';
import type { AppConfig } from '@/config/configuration';
import { MockPayProvider, PayProvider, WechatPayProvider } from './pay.provider';

/**
 * 支付通道注册表。
 * 按 .env 里的 PAY_PROVIDER 决定默认通道，同时保留按订单指定通道的能力
 * （同一个系统里可能小程序走微信、H5 走支付宝）。
 */
@Injectable()
export class PayProviderRegistry {
  private readonly logger = new Logger(PayProviderRegistry.name);
  private readonly providers = new Map<string, PayProvider>();
  private readonly defaultChannel: PayChannel;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const payCfg = this.config.get('pay', { infer: true });
    this.baseUrl = this.config.get('publicBaseUrl', { infer: true });

    // mock 通道永远注册着，方便随时用它验链路
    this.providers.set(PayChannel.MOCK, new MockPayProvider(this.baseUrl));

    if (payCfg.provider === 'wechat') {
      this.providers.set(PayChannel.WECHAT, new WechatPayProvider(payCfg.wechat));
      this.defaultChannel = PayChannel.WECHAT;
      this.logger.log('默认支付通道：微信支付');
    } else {
      this.defaultChannel = PayChannel.MOCK;
      this.logger.warn(
        '默认支付通道：MOCK（模拟支付）。这个通道不会真实收款，仅用于开发和演示，' +
          '上线前务必把 PAY_PROVIDER 改成 wechat 并完成 WechatPayProvider 的接入。',
      );
    }
  }

  get(channel?: PayChannel | null): PayProvider {
    const key = channel ?? this.defaultChannel;
    const p = this.providers.get(key);
    if (!p) {
      throw new Error(`支付通道 ${key} 未配置。可用：${[...this.providers.keys()].join(', ')}`);
    }
    return p;
  }

  get isMockOnly(): boolean {
    return this.defaultChannel === PayChannel.MOCK;
  }

  notifyUrl(channel: string): string {
    return `${this.baseUrl}/api/pay/notify/${channel.toLowerCase()}`;
  }
}
