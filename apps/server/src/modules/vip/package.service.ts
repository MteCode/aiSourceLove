import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, VipPackage } from '@prisma/client';
import { BENEFIT_META, BenefitSpec, VipPackageDto } from '@yuanqiao/shared';
import { BizException } from '@/common/filters/all-exceptions.filter';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { CreateVipPackageDto, UpdateVipPackageDto } from './dto/vip.dto';

@Injectable()
export class PackageService {
  constructor(private readonly prisma: PrismaService) {}

  async list(onlyEnabled = true): Promise<VipPackageDto[]> {
    const rows = await this.prisma.vipPackage.findMany({
      where: onlyEnabled ? { enabled: true } : {},
      orderBy: [{ sort: 'asc' }, { price: 'asc' }],
    });
    return rows.map((r) => this.toDto(r));
  }

  async get(id: string): Promise<VipPackageDto> {
    const p = await this.prisma.vipPackage.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('套餐不存在');
    return this.toDto(p);
  }

  async create(dto: CreateVipPackageDto): Promise<VipPackageDto> {
    this.validateBenefits(dto.benefits);
    const p = await this.prisma.vipPackage.create({
      data: {
        name: dto.name,
        subtitle: dto.subtitle,
        price: dto.price,
        originalPrice: dto.originalPrice,
        durationDays: dto.durationDays,
        benefits: this.normalizeBenefits(dto.benefits) as unknown as Prisma.InputJsonValue,
        isRecommended: dto.isRecommended ?? false,
        sort: dto.sort ?? 0,
        enabled: dto.enabled ?? true,
      },
    });
    return this.toDto(p);
  }

  /**
   * 改套餐。注意：**不影响已售出的订单**——
   * 订单里存了 packageSnapshot，历史订单永远按当时买的权益算。
   */
  async update(id: string, dto: UpdateVipPackageDto): Promise<VipPackageDto> {
    if (dto.benefits) this.validateBenefits(dto.benefits);
    const p = await this.prisma.vipPackage.update({
      where: { id },
      data: {
        name: dto.name,
        subtitle: dto.subtitle,
        price: dto.price,
        originalPrice: dto.originalPrice,
        durationDays: dto.durationDays,
        ...(dto.benefits
          ? { benefits: this.normalizeBenefits(dto.benefits) as unknown as Prisma.InputJsonValue }
          : {}),
        isRecommended: dto.isRecommended,
        sort: dto.sort,
        enabled: dto.enabled,
      },
    });
    return this.toDto(p);
  }

  /** 有订单的套餐不能删，只能下架——删了历史订单就查不到买的是什么了 */
  async remove(id: string): Promise<{ success: boolean; disabled: boolean }> {
    const orderCount = await this.prisma.order.count({ where: { packageId: id } });
    if (orderCount > 0) {
      await this.prisma.vipPackage.update({ where: { id }, data: { enabled: false } });
      return { success: true, disabled: true };
    }
    await this.prisma.vipPackage.delete({ where: { id } });
    return { success: true, disabled: false };
  }

  private validateBenefits(benefits: BenefitSpec[]): void {
    if (!benefits.length) throw new BizException('套餐至少要配置一项权益', 40060);
    const seen = new Set<string>();
    for (const b of benefits) {
      if (seen.has(b.code)) throw new BizException(`权益 ${BENEFIT_META[b.code].label} 重复配置`, 40061);
      seen.add(b.code);
      if (b.quota <= 0) {
        throw new BizException(
          `${BENEFIT_META[b.code].label} 的额度必须大于 0。本系统不支持"无限"权益——` +
            '无限权益没有复购动力，也没法控成本。',
          40062,
        );
      }
    }
  }

  private normalizeBenefits(benefits: BenefitSpec[]): BenefitSpec[] {
    return benefits.map((b) => ({
      code: b.code,
      quota: b.quota,
      cycle: b.cycle ?? BENEFIT_META[b.code].defaultCycle,
    }));
  }

  private toDto(p: VipPackage): VipPackageDto {
    return {
      id: p.id,
      name: p.name,
      subtitle: p.subtitle,
      price: p.price,
      originalPrice: p.originalPrice,
      durationDays: p.durationDays,
      benefits: (p.benefits as unknown as BenefitSpec[]) ?? [],
      isRecommended: p.isRecommended,
      sort: p.sort,
      enabled: p.enabled,
    };
  }
}
