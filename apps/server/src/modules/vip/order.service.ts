import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  BenefitSpec,
  ORDER_AUTO_CLOSE_MINUTES,
  ORDER_STATUS_TRANSITIONS,
  OrderDto,
  OrderStatus,
  PageResult,
  PayChannel,
  PaymentStatus,
  VipPackageDto,
  addDays,
  assertTransition,
  fenToYuan,
} from '@yuanqiao/shared';
import { BizException } from '@/common/filters/all-exceptions.filter';
import { buildPageResult } from '@/common/dto/pagination.dto';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { RedisService } from '@/infra/redis/redis.service';
import { UserContextService } from '@/modules/auth/user-context.service';
import { CommissionService } from '@/modules/matchmaker/commission.service';
import { BenefitService } from './benefit.service';
import { PayProviderRegistry } from './pay/pay.registry';
import type { NotifyResult } from './pay/pay.provider';
import { CreateOrderDto, QueryOrderDto, RefundOrderDto } from './dto/vip.dto';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly benefit: BenefitService,
    private readonly commission: CommissionService,
    private readonly userContext: UserContextService,
    private readonly pay: PayProviderRegistry,
  ) {}

  // ═══════ 下单 ═══════

  async create(userId: string, dto: CreateOrderDto, clientIp: string) {
    const pkg = await this.prisma.vipPackage.findFirst({
      where: { id: dto.packageId, enabled: true },
    });
    if (!pkg) throw new NotFoundException('套餐不存在或已下架');

    // 有未支付订单就复用，别让用户攒一堆待支付订单
    const pending = await this.prisma.order.findFirst({
      where: {
        userId,
        packageId: pkg.id,
        status: OrderStatus.PENDING,
        expireAt: { gt: new Date() },
      },
      include: { payments: { where: { status: PaymentStatus.PENDING }, take: 1 } },
    });
    if (pending) {
      this.logger.log(`复用未支付订单 ${pending.orderNo}`);
      return this.buildPayResult(pending.id, pending.orderNo, pkg.name, pending.amount, dto, clientIp);
    }

    // 归属红娘：从用户档案带出来，用于支付成功后的分润
    const profile = await this.prisma.profile.findFirst({
      where: { userId, deletedAt: null },
      select: { matchmakerId: true },
    });

    const order = await this.prisma.$transaction(async (tx) => {
      const orderNo = await this.prisma.nextSerial('order', 'OD', tx);
      return tx.order.create({
        data: {
          orderNo,
          userId,
          packageId: pkg.id,
          // 快照：套餐以后改价改权益，这张订单还能还原当时买的是什么
          packageSnapshot: {
            name: pkg.name,
            price: pkg.price,
            durationDays: pkg.durationDays,
            benefits: pkg.benefits,
          } as Prisma.InputJsonValue,
          amount: pkg.price,
          status: OrderStatus.PENDING,
          expireAt: new Date(Date.now() + ORDER_AUTO_CLOSE_MINUTES * 60_000),
          matchmakerId: profile?.matchmakerId ?? null,
          clientIp: clientIp.slice(0, 64),
        },
      });
    });

    return this.buildPayResult(order.id, order.orderNo, pkg.name, order.amount, dto, clientIp);
  }

  private async buildPayResult(
    orderId: string,
    orderNo: string,
    packageName: string,
    amount: number,
    dto: CreateOrderDto,
    clientIp: string,
  ) {
    const provider = this.pay.get(dto.payChannel);
    // 每次拉起支付都生成新的 outTradeNo：用户可能第一次没付完关掉了，
    // 微信侧同一个 out_trade_no 状态已锁死，复用会报"订单已存在"
    const outTradeNo = `${orderNo}${String(Date.now()).slice(-4)}`;

    const txn = await this.prisma.paymentTxn.create({
      data: {
        orderId,
        outTradeNo,
        channel: provider.channel as PayChannel,
        amount,
        status: PaymentStatus.PENDING,
      },
    });

    const payParams = await provider.createPayment({
      outTradeNo,
      amount,
      description: `缘桥 ${packageName}`,
      openid: dto.openid,
      clientIp,
      notifyUrl: this.pay.notifyUrl(provider.channel),
    });

    await this.prisma.order.update({
      where: { id: orderId },
      data: { payChannel: provider.channel as PayChannel },
    });

    return {
      order: await this.toDto(orderId),
      payParams: { ...payParams, txnId: txn.id },
    };
  }

  // ═══════ 支付回调（幂等核心）═══════

  /**
   * 处理支付渠道回调。
   *
   * 这是全系统最不能出错的一段代码。出 bug 的后果分两种：
   *   漏发权益 → 用户投诉，能人工补
   *   重复发权益/重复分润 → 资损，且很难发现
   *
   * 四道防线：
   *   1. Redis 锁：同一订单串行处理，挡掉绝大多数并发
   *   2. PaymentTxn.transactionId 唯一索引：渠道重放同一笔回调时直接命中冲突
   *   3. 事务内二次校验 order.status：已 PAID 就直接返回成功，不重复发权益
   *   4. 金额比对：回调金额与订单金额不符时**拒绝入账**并告警（伪造回调的典型特征）
   *
   * 微信支付在收不到 200 时会重试 15 次，所以"已处理过"必须返回成功而不是报错。
   */
  async handleNotify(channel: PayChannel, result: NotifyResult): Promise<{ ok: boolean; message: string }> {
    const txn = await this.prisma.paymentTxn.findUnique({
      where: { outTradeNo: result.outTradeNo },
      include: { order: true },
    });
    if (!txn) {
      // 我方没有这笔流水，但渠道说付了 —— 最危险的情况，必须告警
      this.logger.error(
        `【对账告警】收到未知交易的回调：outTradeNo=${result.outTradeNo} ` +
          `transactionId=${result.transactionId} 金额=${fenToYuan(result.amount)}`,
      );
      return { ok: false, message: '订单不存在' };
    }

    if (!result.success) {
      await this.prisma.paymentTxn.update({
        where: { id: txn.id },
        data: { status: PaymentStatus.FAILED, rawNotify: result.raw as Prisma.InputJsonValue, notifiedAt: new Date() },
      });
      return { ok: true, message: '已记录支付失败' };
    }

    // 防线 1：锁
    const release = await this.redis.acquireLock(`order:${txn.orderId}`, 15);
    if (!release) {
      // 拿不到锁说明另一个请求正在处理，让渠道稍后重试即可
      return { ok: false, message: '处理中，请稍后重试' };
    }

    try {
      // 防线 4：金额校验
      if (result.amount !== txn.amount) {
        this.logger.error(
          `【资金告警】回调金额不符：订单 ${txn.order.orderNo} 应付 ${fenToYuan(txn.amount)}，` +
            `回调 ${fenToYuan(result.amount)}。已拒绝入账。`,
        );
        await this.prisma.paymentTxn.update({
          where: { id: txn.id },
          data: {
            status: PaymentStatus.FAILED,
            errorMsg: `金额不符：期望 ${txn.amount}，实收 ${result.amount}`,
            rawNotify: result.raw as Prisma.InputJsonValue,
            notifiedAt: new Date(),
          },
        });
        return { ok: false, message: '金额不符' };
      }

      await this.prisma.$transaction(async (tx) => {
        // 防线 3：事务内重新读订单状态
        const order = await tx.order.findUnique({
          where: { id: txn.orderId },
          include: { user: { select: { id: true, vipExpireAt: true } } },
        });
        if (!order) throw new Error('订单不存在');

        if (order.status === OrderStatus.PAID) {
          this.logger.log(`订单 ${order.orderNo} 已是已支付状态，跳过重复处理`);
          return;
        }
        if (order.status !== OrderStatus.PENDING) {
          throw new BizException(`订单状态为 ${order.status}，不能标记为已支付`, 40070);
        }

        // 防线 2：写入渠道交易号，唯一索引会挡住重放
        await tx.paymentTxn.update({
          where: { id: txn.id },
          data: {
            transactionId: result.transactionId,
            status: PaymentStatus.SUCCESS,
            rawNotify: result.raw as Prisma.InputJsonValue,
            notifiedAt: result.paidAt,
          },
        });

        assertTransition(ORDER_STATUS_TRANSITIONS, OrderStatus.PENDING, OrderStatus.PAID, '订单状态');
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.PAID, paidAt: result.paidAt },
        });

        // 发权益
        const snapshot = order.packageSnapshot as unknown as {
          durationDays: number;
          benefits: BenefitSpec[];
        };
        await this.benefit.grantFromPackage({
          userId: order.userId,
          benefits: snapshot.benefits ?? [],
          durationDays: snapshot.durationDays,
          orderId: order.id,
          tx,
        });

        // 续期 VIP：从当前到期日往后加，而不是从今天算起——
        // 不然用户提前续费会白白损失剩余天数，这是必被投诉的点
        const base =
          order.user.vipExpireAt && order.user.vipExpireAt > new Date()
            ? order.user.vipExpireAt
            : new Date();
        await tx.user.update({
          where: { id: order.userId },
          data: { isVip: true, vipExpireAt: addDays(base, snapshot.durationDays) },
        });

        // 红娘分润
        if (order.matchmakerId) {
          const mm = await tx.matchmaker.findUnique({
            where: { id: order.matchmakerId },
            select: { commissionRate: true },
          });
          if (mm) {
            await this.commission.grantForOrder(
              {
                matchmakerId: order.matchmakerId,
                orderId: order.id,
                orderNo: order.orderNo,
                amount: order.amount,
                rate: Number(mm.commissionRate),
              },
              tx,
            );
          }
        }
      });

      // VIP 状态变了，鉴权缓存要立刻失效
      await this.userContext.invalidate(txn.order.userId);
      this.logger.log(`订单 ${txn.order.orderNo} 支付成功，¥${fenToYuan(txn.amount)}`);
      return { ok: true, message: 'OK' };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        // 唯一键冲突 = 这笔回调之前已经处理过了，对渠道来说是成功
        this.logger.warn(`回调重放已被幂等拦截：${result.transactionId}`);
        return { ok: true, message: 'OK（重复回调）' };
      }
      const msg = (e as Error).message;
      this.logger.error(`处理回调失败 ${result.outTradeNo}：${msg}`);
      await this.prisma.paymentTxn
        .update({
          where: { id: txn.id },
          data: { retryCount: { increment: 1 }, errorMsg: msg.slice(0, 500) },
        })
        .catch(() => undefined);
      return { ok: false, message: msg };
    } finally {
      await release();
    }
  }

  /**
   * 【开发用】模拟支付成功。
   *
   * 刻意走和真实回调**完全相同**的 handleNotify 路径：
   * 本地在这里验证过的幂等、发权益、分润逻辑，接真通道时同样成立。
   * 金额从流水里读，而不是让调用方传——不然这个接口就成了"想充多少充多少"。
   */
  async mockPay(outTradeNo: string, success = true) {
    const provider = this.pay.get(PayChannel.MOCK);
    const txn = await this.prisma.paymentTxn.findUnique({
      where: { outTradeNo },
      select: { amount: true },
    });
    if (!txn) throw new NotFoundException(`交易号 ${outTradeNo} 不存在`);

    const result = await provider.parseNotify({}, JSON.stringify({ outTradeNo, success }));
    return this.handleNotify(PayChannel.MOCK, { ...result, amount: txn.amount });
  }

  // ═══════ 退款 ═══════

  /**
   * 退款。会同时收回权益、下调 VIP 到期日、冲销红娘分润。
   * 只退不收权益是这类系统的经典漏洞：用户买完解锁一批人再退款，白嫖。
   */
  async refund(orderId: string, dto: RefundOrderDto, operatorId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: { where: { status: PaymentStatus.SUCCESS }, take: 1 } },
    });
    if (!order) throw new NotFoundException('订单不存在');

    assertTransition(ORDER_STATUS_TRANSITIONS, order.status as OrderStatus, OrderStatus.REFUNDING, '订单状态');

    const refundAmount = dto.amount ?? order.amount;
    if (refundAmount > order.amount - order.refundAmount) {
      throw new BizException('退款金额超过可退余额', 40071);
    }

    const txn = order.payments[0];
    const provider = this.pay.get(order.payChannel ?? undefined);

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.REFUNDING, refundReason: dto.reason },
    });

    let refundOk = false;
    let refundId = '';
    try {
      if (txn) {
        const r = await provider.refund({
          outTradeNo: txn.outTradeNo,
          outRefundNo: `RF${order.orderNo}`,
          totalAmount: order.amount,
          refundAmount,
        });
        refundOk = r.success;
        refundId = r.refundId;
      } else {
        // 没有成功流水说明本来就没收到钱，直接置为已退
        refundOk = true;
      }
    } catch (e) {
      this.logger.error(`调用渠道退款失败：${(e as Error).message}`);
      await this.prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.PAID } });
      throw new BizException(`渠道退款失败：${(e as Error).message}`, 50070);
    }

    if (!refundOk) {
      await this.prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.PAID } });
      throw new BizException('渠道退款未成功', 50071);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.REFUNDED,
          refundAmount: { increment: refundAmount },
          refundedAt: new Date(),
        },
      });
      if (txn) {
        await tx.paymentTxn.update({
          where: { id: txn.id },
          data: { status: PaymentStatus.REFUNDED, errorMsg: `退款单号 ${refundId}` },
        });
      }

      // 收回权益
      const revoked = await this.benefit.revokeByOrder(orderId, tx);

      // 回退 VIP 到期日
      const snapshot = order.packageSnapshot as unknown as { durationDays: number };
      const user = await tx.user.findUnique({
        where: { id: order.userId },
        select: { vipExpireAt: true },
      });
      if (user?.vipExpireAt) {
        const rolled = addDays(user.vipExpireAt, -snapshot.durationDays);
        await tx.user.update({
          where: { id: order.userId },
          data: { vipExpireAt: rolled, isVip: rolled > new Date() },
        });
      }

      // 冲销分润
      await this.commission.revokeForOrder(orderId, tx);

      this.logger.log(
        `订单 ${order.orderNo} 退款 ¥${fenToYuan(refundAmount)}，回收 ${revoked} 项权益，操作人 ${operatorId}`,
      );
    });

    await this.userContext.invalidate(order.userId);
    return this.toDto(orderId);
  }

  // ═══════ 定时任务用 ═══════

  /** 关闭超时未支付的订单 */
  async closeExpired(): Promise<number> {
    const r = await this.prisma.order.updateMany({
      where: { status: OrderStatus.PENDING, expireAt: { lt: new Date() } },
      data: { status: OrderStatus.CLOSED },
    });
    if (r.count) this.logger.log(`关闭了 ${r.count} 笔超时未支付订单`);
    return r.count;
  }

  /** VIP 到期处理 */
  async expireVips(): Promise<number> {
    const expired = await this.prisma.user.findMany({
      where: { isVip: true, vipExpireAt: { lt: new Date() } },
      select: { id: true },
    });
    if (!expired.length) return 0;
    await this.prisma.user.updateMany({
      where: { id: { in: expired.map((e) => e.id) } },
      data: { isVip: false },
    });
    await Promise.all(expired.map((e) => this.userContext.invalidate(e.id)));
    this.logger.log(`${expired.length} 位用户 VIP 到期`);
    return expired.length;
  }

  // ═══════ 查询 ═══════

  async list(query: QueryOrderDto): Promise<PageResult<OrderDto>> {
    const where: Prisma.OrderWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.userId) where.userId = query.userId;
    if (query.matchmakerId) where.matchmakerId = query.matchmakerId;
    if (query.keyword?.trim()) {
      const kw = query.keyword.trim();
      where.OR = [{ orderNo: { contains: kw } }, { user: { phone: { contains: kw } } }];
    }

    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
        include: { user: { select: { phone: true } }, package: { select: { name: true } } },
      }),
      this.prisma.order.count({ where }),
    ]);

    return buildPageResult(
      rows.map((o) => this.mapDto(o)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async toDto(id: string): Promise<OrderDto> {
    const o = await this.prisma.order.findUnique({
      where: { id },
      include: { user: { select: { phone: true } }, package: { select: { name: true } } },
    });
    if (!o) throw new NotFoundException('订单不存在');
    return this.mapDto(o);
  }

  private mapDto(
    o: Prisma.OrderGetPayload<{
      include: { user: { select: { phone: true } }; package: { select: { name: true } } };
    }>,
  ): OrderDto {
    const snap = o.packageSnapshot as unknown as { name?: string } | null;
    return {
      id: o.id,
      orderNo: o.orderNo,
      userId: o.userId,
      userPhone: o.user.phone,
      packageId: o.packageId,
      packageName: snap?.name ?? o.package.name,
      amount: o.amount,
      payChannel: o.payChannel as PayChannel | null,
      status: o.status as OrderStatus,
      paidAt: o.paidAt?.toISOString() ?? null,
      expireAt: o.expireAt?.toISOString() ?? null,
      refundAmount: o.refundAmount,
      refundReason: o.refundReason,
      matchmakerId: o.matchmakerId,
      createdAt: o.createdAt.toISOString(),
    };
  }
}
