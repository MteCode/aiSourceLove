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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayController = exports.OrderController = exports.VipController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const shared_1 = require("@yuanqiao/shared");
const decorators_1 = require("../../common/decorators");
const benefit_service_1 = require("./benefit.service");
const order_service_1 = require("./order.service");
const package_service_1 = require("./package.service");
const reconcile_service_1 = require("./reconcile.service");
const pay_registry_1 = require("./pay/pay.registry");
const vip_dto_1 = require("./dto/vip.dto");
let VipController = class VipController {
    pkg;
    benefit;
    constructor(pkg, benefit) {
        this.pkg = pkg;
        this.benefit = benefit;
    }
    packages() {
        return this.pkg.list(true);
    }
    allPackages() {
        return this.pkg.list(false);
    }
    createPackage(dto) {
        return this.pkg.create(dto);
    }
    updatePackage(id, dto) {
        return this.pkg.update(id, dto);
    }
    removePackage(id) {
        return this.pkg.remove(id);
    }
    myBenefits(userId) {
        return this.benefit.listUserBenefits(userId);
    }
};
exports.VipController = VipController;
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)('packages'),
    (0, swagger_1.ApiOperation)({ summary: '在售套餐列表' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], VipController.prototype, "packages", null);
__decorate([
    (0, common_1.Get)('packages/all'),
    (0, decorators_1.RequirePermissions)('vip:manage'),
    (0, swagger_1.ApiOperation)({ summary: '全部套餐（含已下架，后台用）' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], VipController.prototype, "allPackages", null);
__decorate([
    (0, common_1.Post)('packages'),
    (0, decorators_1.RequirePermissions)('vip:manage'),
    (0, decorators_1.LogAction)('VIP', '新建套餐'),
    (0, swagger_1.ApiOperation)({ summary: '新建套餐' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [vip_dto_1.CreateVipPackageDto]),
    __metadata("design:returntype", void 0)
], VipController.prototype, "createPackage", null);
__decorate([
    (0, common_1.Put)('packages/:id'),
    (0, decorators_1.RequirePermissions)('vip:manage'),
    (0, decorators_1.LogAction)('VIP', '修改套餐'),
    (0, swagger_1.ApiOperation)({ summary: '修改套餐（不影响已售出订单，它们有快照）' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, vip_dto_1.UpdateVipPackageDto]),
    __metadata("design:returntype", void 0)
], VipController.prototype, "updatePackage", null);
__decorate([
    (0, common_1.Delete)('packages/:id'),
    (0, decorators_1.RequirePermissions)('vip:manage'),
    (0, decorators_1.LogAction)('VIP', '删除套餐'),
    (0, swagger_1.ApiOperation)({ summary: '删除套餐（有订单则自动改为下架）' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], VipController.prototype, "removePackage", null);
__decorate([
    (0, common_1.Get)('benefits'),
    (0, swagger_1.ApiOperation)({ summary: '我的权益余量' }),
    __param(0, (0, decorators_1.CurrentUser)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VipController.prototype, "myBenefits", null);
exports.VipController = VipController = __decorate([
    (0, swagger_1.ApiTags)('VIP / 套餐'),
    (0, common_1.Controller)('vip'),
    __metadata("design:paramtypes", [package_service_1.PackageService,
        benefit_service_1.BenefitService])
], VipController);
let OrderController = class OrderController {
    order;
    constructor(order) {
        this.order = order;
    }
    create(userId, dto, ip) {
        return this.order.create(userId, dto, ip);
    }
    mine(userId, query) {
        return this.order.list({ ...query, userId });
    }
    list(query) {
        return this.order.list(query);
    }
    detail(id) {
        return this.order.toDto(id);
    }
    refund(id, dto, operatorId) {
        return this.order.refund(id, dto, operatorId);
    }
};
exports.OrderController = OrderController;
__decorate([
    (0, common_1.Post)(),
    (0, decorators_1.LogAction)('订单', '创建订单'),
    (0, swagger_1.ApiOperation)({ summary: '下单，返回拉起支付所需参数' }),
    __param(0, (0, decorators_1.CurrentUser)('userId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, vip_dto_1.CreateOrderDto, String]),
    __metadata("design:returntype", void 0)
], OrderController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('mine'),
    (0, swagger_1.ApiOperation)({ summary: '我的订单' }),
    __param(0, (0, decorators_1.CurrentUser)('userId')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, vip_dto_1.QueryOrderDto]),
    __metadata("design:returntype", void 0)
], OrderController.prototype, "mine", null);
__decorate([
    (0, common_1.Get)(),
    (0, decorators_1.RequirePermissions)('order:list'),
    (0, swagger_1.ApiOperation)({ summary: '订单列表（后台）' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [vip_dto_1.QueryOrderDto]),
    __metadata("design:returntype", void 0)
], OrderController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '订单详情' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OrderController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(':id/refund'),
    (0, decorators_1.RequirePermissions)('order:refund'),
    (0, decorators_1.LogAction)('订单', '退款'),
    (0, swagger_1.ApiOperation)({
        summary: '退款',
        description: '会同时收回权益、回退 VIP 到期日、冲销红娘分润',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentUser)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, vip_dto_1.RefundOrderDto, String]),
    __metadata("design:returntype", void 0)
], OrderController.prototype, "refund", null);
exports.OrderController = OrderController = __decorate([
    (0, swagger_1.ApiTags)('订单与支付'),
    (0, common_1.Controller)('orders'),
    __metadata("design:paramtypes", [order_service_1.OrderService])
], OrderController);
let PayController = class PayController {
    order;
    pay;
    reconcile;
    constructor(order, pay, reconcile) {
        this.order = order;
        this.pay = pay;
        this.reconcile = reconcile;
    }
    /**
     * 模拟支付确认。仅在 mock 通道下可用。
     * 它走的是和真实回调完全相同的 handleNotify 路径，
     * 所以本地验过的幂等逻辑，接真通道时同样成立。
     */
    mockConfirm(dto) {
        return this.order.mockPay(dto.outTradeNo, dto.success !== false);
    }
    async wechatNotify(headers, req) {
        const provider = this.pay.get(shared_1.PayChannel.WECHAT);
        const raw = req.rawBody?.toString('utf8') ?? '';
        try {
            const result = await provider.parseNotify(headers, raw);
            const r = await this.order.handleNotify(shared_1.PayChannel.WECHAT, result);
            // 用 __raw 跳过统一信封——微信要求的是它自己约定的格式
            return { __raw: provider.notifyResponse(r.ok, r.message) };
        }
        catch (e) {
            return { __raw: provider.notifyResponse(false, e.message) };
        }
    }
    reconcileList() {
        return this.reconcile.list();
    }
    runReconcile(date) {
        return this.reconcile.reconcile(date);
    }
};
exports.PayController = PayController;
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Post)('mock/confirm'),
    (0, swagger_1.ApiOperation)({ summary: '【开发用】模拟支付成功' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [vip_dto_1.MockPayDto]),
    __metadata("design:returntype", void 0)
], PayController.prototype, "mockConfirm", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Post)('notify/wechat'),
    (0, swagger_1.ApiOperation)({ summary: '微信支付回调（渠道调用，勿手动请求）' }),
    __param(0, (0, common_1.Headers)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PayController.prototype, "wechatNotify", null);
__decorate([
    (0, common_1.Get)('reconcile'),
    (0, decorators_1.RequirePermissions)('order:list'),
    (0, swagger_1.ApiOperation)({ summary: '对账记录' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PayController.prototype, "reconcileList", null);
__decorate([
    (0, common_1.Post)('reconcile'),
    (0, decorators_1.RequirePermissions)('order:list'),
    (0, decorators_1.LogAction)('支付', '手动对账'),
    (0, swagger_1.ApiOperation)({ summary: '手动触发某天对账（不传日期则对昨天）' }),
    __param(0, (0, common_1.Body)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PayController.prototype, "runReconcile", null);
exports.PayController = PayController = __decorate([
    (0, swagger_1.ApiTags)('订单与支付'),
    (0, common_1.Controller)('pay'),
    __metadata("design:paramtypes", [order_service_1.OrderService,
        pay_registry_1.PayProviderRegistry,
        reconcile_service_1.ReconcileService])
], PayController);
//# sourceMappingURL=vip.controller.js.map