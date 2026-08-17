import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PayChannel, UserBenefitDto, VipPackageDto } from '@yuanqiao/shared';
import type { AuthUser } from '@/common/types/auth-user';
import { ClientIp, CurrentUser, LogAction, Public, RequirePermissions } from '@/common/decorators';
import { BenefitService } from './benefit.service';
import { OrderService } from './order.service';
import { PackageService } from './package.service';
import { ReconcileService } from './reconcile.service';
import { PayProviderRegistry } from './pay/pay.registry';
import {
  CreateOrderDto,
  CreateVipPackageDto,
  MockPayDto,
  QueryOrderDto,
  RefundOrderDto,
  UpdateVipPackageDto,
} from './dto/vip.dto';

@ApiTags('VIP / 套餐')
@Controller('vip')
export class VipController {
  constructor(
    private readonly pkg: PackageService,
    private readonly benefit: BenefitService,
  ) {}

  @Public()
  @Get('packages')
  @ApiOperation({ summary: '在售套餐列表' })
  packages(): Promise<VipPackageDto[]> {
    return this.pkg.list(true);
  }

  @Get('packages/all')
  @RequirePermissions('vip:manage')
  @ApiOperation({ summary: '全部套餐（含已下架，后台用）' })
  allPackages(): Promise<VipPackageDto[]> {
    return this.pkg.list(false);
  }

  @Post('packages')
  @RequirePermissions('vip:manage')
  @LogAction('VIP', '新建套餐')
  @ApiOperation({ summary: '新建套餐' })
  createPackage(@Body() dto: CreateVipPackageDto) {
    return this.pkg.create(dto);
  }

  @Put('packages/:id')
  @RequirePermissions('vip:manage')
  @LogAction('VIP', '修改套餐')
  @ApiOperation({ summary: '修改套餐（不影响已售出订单，它们有快照）' })
  updatePackage(@Param('id') id: string, @Body() dto: UpdateVipPackageDto) {
    return this.pkg.update(id, dto);
  }

  @Delete('packages/:id')
  @RequirePermissions('vip:manage')
  @LogAction('VIP', '删除套餐')
  @ApiOperation({ summary: '删除套餐（有订单则自动改为下架）' })
  removePackage(@Param('id') id: string) {
    return this.pkg.remove(id);
  }

  @Post('grant')
  @RequirePermissions('vip:manage')
  @LogAction('交易管理', '后台开通 VIP')
  @ApiOperation({
    summary: '后台给用户开通 VIP',
    description: '支付未上线时的口子：线下收款、样板号、早期用户补偿都走这里。走和支付成功相同的发放路径。',
  })
  grant(
    @Body() dto: { userId: string; packageId: string; remark?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.benefit.grantByAdmin({ ...dto, operatorId: user.userId });
  }

  @Get('benefits')
  @ApiOperation({ summary: '我的权益余量' })
  myBenefits(@CurrentUser('userId') userId: string): Promise<UserBenefitDto[]> {
    return this.benefit.listUserBenefits(userId);
  }
}

@ApiTags('订单与支付')
@Controller('orders')
export class OrderController {
  constructor(private readonly order: OrderService) {}

  @Post()
  @LogAction('订单', '创建订单')
  @ApiOperation({ summary: '下单，返回拉起支付所需参数' })
  create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateOrderDto,
    @ClientIp() ip: string,
  ) {
    return this.order.create(userId, dto, ip);
  }

  @Get('mine')
  @ApiOperation({ summary: '我的订单' })
  mine(@CurrentUser('userId') userId: string, @Query() query: QueryOrderDto) {
    return this.order.list({ ...query, userId } as QueryOrderDto);
  }

  @Get()
  @RequirePermissions('order:list')
  @ApiOperation({ summary: '订单列表（后台）' })
  list(@Query() query: QueryOrderDto) {
    return this.order.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '订单详情' })
  detail(@Param('id') id: string) {
    return this.order.toDto(id);
  }

  @Post(':id/refund')
  @RequirePermissions('order:refund')
  @LogAction('订单', '退款')
  @ApiOperation({
    summary: '退款',
    description: '会同时收回权益、回退 VIP 到期日、冲销红娘分润',
  })
  refund(
    @Param('id') id: string,
    @Body() dto: RefundOrderDto,
    @CurrentUser('userId') operatorId: string,
  ) {
    return this.order.refund(id, dto, operatorId);
  }
}

@ApiTags('订单与支付')
@Controller('pay')
export class PayController {
  constructor(
    private readonly order: OrderService,
    private readonly pay: PayProviderRegistry,
    private readonly reconcile: ReconcileService,
  ) {}

  /**
   * 模拟支付确认。仅在 mock 通道下可用。
   * 它走的是和真实回调完全相同的 handleNotify 路径，
   * 所以本地验过的幂等逻辑，接真通道时同样成立。
   */
  @Public()
  @Post('mock/confirm')
  @ApiOperation({ summary: '【开发用】模拟支付成功' })
  mockConfirm(@Body() dto: MockPayDto) {
    return this.order.mockPay(dto.outTradeNo, dto.success !== false);
  }

  @Public()
  @Post('notify/wechat')
  @ApiOperation({ summary: '微信支付回调（渠道调用，勿手动请求）' })
  async wechatNotify(
    @Headers() headers: Record<string, string>,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const provider = this.pay.get(PayChannel.WECHAT);
    const raw = req.rawBody?.toString('utf8') ?? '';
    try {
      const result = await provider.parseNotify(headers, raw);
      const r = await this.order.handleNotify(PayChannel.WECHAT, result);
      // 用 __raw 跳过统一信封——微信要求的是它自己约定的格式
      return { __raw: provider.notifyResponse(r.ok, r.message) };
    } catch (e) {
      return { __raw: provider.notifyResponse(false, (e as Error).message) };
    }
  }

  @Get('reconcile')
  @RequirePermissions('order:list')
  @ApiOperation({ summary: '对账记录' })
  reconcileList() {
    return this.reconcile.list();
  }

  @Post('reconcile')
  @RequirePermissions('order:list')
  @LogAction('支付', '手动对账')
  @ApiOperation({ summary: '手动触发某天对账（不传日期则对昨天）' })
  runReconcile(@Body('date') date?: string) {
    return this.reconcile.reconcile(date);
  }
}
