"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VipModule = void 0;
const common_1 = require("@nestjs/common");
const matchmaker_module_1 = require("../matchmaker/matchmaker.module");
const benefit_service_1 = require("./benefit.service");
const order_service_1 = require("./order.service");
const package_service_1 = require("./package.service");
const reconcile_service_1 = require("./reconcile.service");
const pay_registry_1 = require("./pay/pay.registry");
const vip_controller_1 = require("./vip.controller");
/**
 * BenefitService 被 PrivacyModule / MatchModule 依赖，
 * 而 OrderService 又依赖 MatchmakerModule 的 CommissionService，
 * 形成了 Vip ↔ Matchmaker 的环，用 forwardRef 打破。
 */
let VipModule = class VipModule {
};
exports.VipModule = VipModule;
exports.VipModule = VipModule = __decorate([
    (0, common_1.Module)({
        imports: [(0, common_1.forwardRef)(() => matchmaker_module_1.MatchmakerModule)],
        controllers: [vip_controller_1.VipController, vip_controller_1.OrderController, vip_controller_1.PayController],
        providers: [benefit_service_1.BenefitService, package_service_1.PackageService, order_service_1.OrderService, reconcile_service_1.ReconcileService, pay_registry_1.PayProviderRegistry],
        exports: [benefit_service_1.BenefitService, package_service_1.PackageService, order_service_1.OrderService, reconcile_service_1.ReconcileService],
    })
], VipModule);
//# sourceMappingURL=vip.module.js.map