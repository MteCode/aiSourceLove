import { Module, forwardRef } from '@nestjs/common';
import { MatchModule } from '@/modules/match/match.module';
import { PrivacyModule } from '@/modules/privacy/privacy.module';
import { CommissionService } from './commission.service';
import { IntroductionService } from './introduction.service';
import { MatchmakerService } from './matchmaker.service';
import {
  CommissionController,
  IntroductionController,
  MatchmakerController,
} from './matchmaker.controller';

/**
 * Matchmaker / Match / Privacy / Vip 之间有三个环，都穿过 Matchmaker ↔ Vip：
 *   matchmaker → privacy → vip → matchmaker
 *   matchmaker → match → privacy → vip → matchmaker
 *   matchmaker → match → vip → matchmaker
 * 环上每条边都要 forwardRef：只在一条边上加，从别的方向进入时
 * 被引用的模块仍然是 undefined（这个 bug 编译期看不出来，只有启动时才炸）。
 */
@Module({
  imports: [forwardRef(() => PrivacyModule), forwardRef(() => MatchModule)],
  controllers: [MatchmakerController, IntroductionController, CommissionController],
  providers: [MatchmakerService, IntroductionService, CommissionService],
  exports: [MatchmakerService, IntroductionService, CommissionService],
})
export class MatchmakerModule {}
