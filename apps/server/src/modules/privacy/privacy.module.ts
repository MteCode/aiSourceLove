import { Module } from '@nestjs/common';
import { FieldModule } from '@/modules/field/field.module';
import { VipModule } from '@/modules/vip/vip.module';
import { PrivacyService } from './privacy.service';

@Module({
  imports: [FieldModule, VipModule],
  providers: [PrivacyService],
  exports: [PrivacyService],
})
export class PrivacyModule {}
