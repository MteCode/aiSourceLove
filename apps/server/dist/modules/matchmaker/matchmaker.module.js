"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchmakerModule = void 0;
const common_1 = require("@nestjs/common");
const match_module_1 = require("../match/match.module");
const privacy_module_1 = require("../privacy/privacy.module");
const commission_service_1 = require("./commission.service");
const introduction_service_1 = require("./introduction.service");
const matchmaker_service_1 = require("./matchmaker.service");
const matchmaker_controller_1 = require("./matchmaker.controller");
let MatchmakerModule = class MatchmakerModule {
};
exports.MatchmakerModule = MatchmakerModule;
exports.MatchmakerModule = MatchmakerModule = __decorate([
    (0, common_1.Module)({
        imports: [privacy_module_1.PrivacyModule, match_module_1.MatchModule],
        controllers: [matchmaker_controller_1.MatchmakerController, matchmaker_controller_1.IntroductionController, matchmaker_controller_1.CommissionController],
        providers: [matchmaker_service_1.MatchmakerService, introduction_service_1.IntroductionService, commission_service_1.CommissionService],
        exports: [matchmaker_service_1.MatchmakerService, introduction_service_1.IntroductionService, commission_service_1.CommissionService],
    })
], MatchmakerModule);
//# sourceMappingURL=matchmaker.module.js.map