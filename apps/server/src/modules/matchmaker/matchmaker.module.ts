import { Module } from '@nestjs/common';
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

@Module({
  imports: [PrivacyModule, MatchModule],
  controllers: [MatchmakerController, IntroductionController, CommissionController],
  providers: [MatchmakerService, IntroductionService, CommissionService],
  exports: [MatchmakerService, IntroductionService, CommissionService],
})
export class MatchmakerModule {}
