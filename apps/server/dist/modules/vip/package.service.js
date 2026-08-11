"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@yuanqiao/shared");
const all_exceptions_filter_1 = require("../../common/filters/all-exceptions.filter");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
let PackageService = class PackageService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(onlyEnabled = true) {
        const rows = await this.prisma.vipPackage.findMany({
            where: onlyEnabled ? { enabled: true } : {},
            orderBy: [{ sort: 'asc' }, { price: 'asc' }],
        });
        return rows.map((r) => this.toDto(r));
    }
    async get(id) {
        const p = await this.prisma.vipPackage.findUnique({ where: { id } });
        if (!p)
            throw new common_1.NotFoundException('套餐不存在');
        return this.toDto(p);
    }
    async create(dto) {
        this.validateBenefits(dto.benefits);
        const p = await this.prisma.vipPackage.create({
            data: {
                name: dto.name,
                subtitle: dto.subtitle,
                price: dto.price,
                originalPrice: dto.originalPrice,
                durationDays: dto.durationDays,
                benefits: this.normalizeBenefits(dto.benefits),
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
    async update(id, dto) {
        if (dto.benefits)
            this.validateBenefits(dto.benefits);
        const p = await this.prisma.vipPackage.update({
            where: { id },
            data: {
                name: dto.name,
                subtitle: dto.subtitle,
                price: dto.price,
                originalPrice: dto.originalPrice,
                durationDays: dto.durationDays,
                ...(dto.benefits
                    ? { benefits: this.normalizeBenefits(dto.benefits) }
                    : {}),
                isRecommended: dto.isRecommended,
                sort: dto.sort,
                enabled: dto.enabled,
            },
        });
        return this.toDto(p);
    }
    /** 有订单的套餐不能删，只能下架——删了历史订单就查不到买的是什么了 */
    async remove(id) {
        const orderCount = await this.prisma.order.count({ where: { packageId: id } });
        if (orderCount > 0) {
            await this.prisma.vipPackage.update({ where: { id }, data: { enabled: false } });
            return { success: true, disabled: true };
        }
        await this.prisma.vipPackage.delete({ where: { id } });
        return { success: true, disabled: false };
    }
    validateBenefits(benefits) {
        if (!benefits.length)
            throw new all_exceptions_filter_1.BizException('套餐至少要配置一项权益', 40060);
        const seen = new Set();
        for (const b of benefits) {
            if (seen.has(b.code))
                throw new all_exceptions_filter_1.BizException(`权益 ${shared_1.BENEFIT_META[b.code].label} 重复配置`, 40061);
            seen.add(b.code);
            if (b.quota <= 0) {
                throw new all_exceptions_filter_1.BizException(`${shared_1.BENEFIT_META[b.code].label} 的额度必须大于 0。本系统不支持"无限"权益——` +
                    '无限权益没有复购动力，也没法控成本。', 40062);
            }
        }
    }
    normalizeBenefits(benefits) {
        return benefits.map((b) => ({
            code: b.code,
            quota: b.quota,
            cycle: b.cycle ?? shared_1.BENEFIT_META[b.code].defaultCycle,
        }));
    }
    toDto(p) {
        return {
            id: p.id,
            name: p.name,
            subtitle: p.subtitle,
            price: p.price,
            originalPrice: p.originalPrice,
            durationDays: p.durationDays,
            benefits: p.benefits ?? [],
            isRecommended: p.isRecommended,
            sort: p.sort,
            enabled: p.enabled,
        };
    }
};
exports.PackageService = PackageService;
exports.PackageService = PackageService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PackageService);
//# sourceMappingURL=package.service.js.map