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
exports.DashboardController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../../common/decorators");
const dashboard_service_1 = require("./dashboard.service");
let DashboardController = class DashboardController {
    dashboard;
    constructor(dashboard) {
        this.dashboard = dashboard;
    }
    overview() {
        return this.dashboard.overview();
    }
};
exports.DashboardController = DashboardController;
__decorate([
    (0, common_1.Get)(),
    (0, decorators_1.RequirePermissions)('dashboard:view'),
    (0, swagger_1.ApiOperation)({ summary: '数据看板总览' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "overview", null);
exports.DashboardController = DashboardController = __decorate([
    (0, swagger_1.ApiTags)('后台 / 数据看板'),
    (0, common_1.Controller)('dashboard'),
    __metadata("design:paramtypes", [dashboard_service_1.DashboardService])
], DashboardController);
//# sourceMappingURL=dashboard.controller.js.map