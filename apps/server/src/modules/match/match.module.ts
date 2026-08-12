import { Module, forwardRef } from '@nestjs/common';
import { PrivacyModule } from '@/modules/privacy/privacy.module';
import { VipModule } from '@/modules/vip/vip.module';
import { MatchController } from './match.controller';
import { MatchService } from './match.service';

@Module({
  imports: [forwardRef(() => PrivacyModule), forwardRef(() => VipModule)],
  controllers: [MatchController],
  providers: [MatchService],
  exports: [MatchService],
})
export class MatchModule {}
