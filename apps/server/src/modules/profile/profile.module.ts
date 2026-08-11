import { Module } from '@nestjs/common';
import { FieldModule } from '@/modules/field/field.module';
import { MatchmakerModule } from '@/modules/matchmaker/matchmaker.module';
import { PrivacyModule } from '@/modules/privacy/privacy.module';
import { AdminProfileController, ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [FieldModule, PrivacyModule, MatchmakerModule],
  controllers: [ProfileController, AdminProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
