import { Module } from '@nestjs/common';
import { MatchmakerModule } from '@/modules/matchmaker/matchmaker.module';
import { SystemModule } from '@/modules/system/system.module';
import { VipModule } from '@/modules/vip/vip.module';
import { TasksService } from './tasks.service';

@Module({
  imports: [VipModule, MatchmakerModule, SystemModule],
  providers: [TasksService],
})
export class TasksModule {}
