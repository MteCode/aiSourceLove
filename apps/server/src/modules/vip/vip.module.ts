import { Module, forwardRef } from '@nestjs/common';
import { MatchmakerModule } from '@/modules/matchmaker/matchmaker.module';
import { BenefitService } from './benefit.service';
import { OrderService } from './order.service';
import { PackageService } from './package.service';
import { ReconcileService } from './reconcile.service';
import { PayProviderRegistry } from './pay/pay.registry';
import { OrderController, PayController, VipController } from './vip.controller';

/**
 * BenefitService 被 PrivacyModule / MatchModule 依赖，
 * 而 OrderService 又依赖 MatchmakerModule 的 CommissionService，
 * 形成了 Vip ↔ Matchmaker 的环，用 forwardRef 打破。
 */
@Module({
  imports: [forwardRef(() => MatchmakerModule)],
  controllers: [VipController, OrderController, PayController],
  providers: [BenefitService, PackageService, OrderService, ReconcileService, PayProviderRegistry],
  exports: [BenefitService, PackageService, OrderService, ReconcileService],
})
export class VipModule {}
