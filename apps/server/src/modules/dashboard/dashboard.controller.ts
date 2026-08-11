import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { DashboardDto } from '@yuanqiao/shared';
import { RequirePermissions } from '@/common/decorators';
import { DashboardService } from './dashboard.service';

@ApiTags('后台 / 数据看板')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @RequirePermissions('dashboard:view')
  @ApiOperation({ summary: '数据看板总览' })
  overview(): Promise<DashboardDto> {
    return this.dashboard.overview();
  }
}
