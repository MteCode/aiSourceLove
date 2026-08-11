"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var StorageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 10 * 1024 * 1024;
/**
 * 本地文件存储 + 照片打码。
 *
 * 生产上量后换 OSS/COS：把 save* 换成 SDK 调用即可，接口不变。
 * 打码这一步不能放前端——前端打码等于没打，抓包就拿到原图了。
 */
let StorageService = StorageService_1 = class StorageService {
    config;
    logger = new common_1.Logger(StorageService_1.name);
    uploadDir;
    baseUrl;
    constructor(config) {
        this.config = config;
        this.uploadDir = this.config.get('storage', { infer: true }).uploadDir;
        this.baseUrl = this.config.get('publicBaseUrl', { infer: true });
    }
    /** 存普通文件 */
    async saveFile(buffer, originalName, mime) {
        this.validate(buffer, mime);
        const rel = this.buildRelPath(originalName);
        const abs = (0, node_path_1.join)(this.uploadDir, rel);
        await (0, promises_1.mkdir)((0, node_path_1.join)(abs, '..'), { recursive: true });
        await (0, promises_1.writeFile)(abs, buffer);
        return {
            path: `/uploads/${rel}`,
            url: `${this.baseUrl}/uploads/${rel}`,
            size: buffer.length,
        };
    }
    /**
     * 存照片，同时生成打码版。
     *
     * 打码策略：高斯模糊 + 缩小再放大。只模糊不缩放的话，
     * 用锐化算法能部分还原；先降到 64px 宽再模糊就不可逆了。
     */
    async savePhoto(buffer, originalName, mime) {
        this.validate(buffer, mime);
        // sharp 是原生模块，装不上时不能让整个上传功能挂掉
        let sharp;
        try {
            sharp = (await Promise.resolve().then(() => __importStar(require('sharp')))).default;
        }
        catch (e) {
            this.logger.error(`sharp 不可用，照片将不做压缩与打码：${e.message}`);
            const f = await this.saveFile(buffer, originalName, mime);
            return { ...f, maskedUrl: f.url, maskedPath: f.path };
        }
        const rel = this.buildRelPath(originalName, '.jpg');
        const maskedRel = rel.replace(/\.jpg$/, '_masked.jpg');
        const abs = (0, node_path_1.join)(this.uploadDir, rel);
        const maskedAbs = (0, node_path_1.join)(this.uploadDir, maskedRel);
        await (0, promises_1.mkdir)((0, node_path_1.join)(abs, '..'), { recursive: true });
        const img = sharp(buffer).rotate(); // rotate() 无参 = 按 EXIF 摆正
        const meta = await img.metadata();
        // 原图：限制最长边 1600，转 jpg 压到 85
        await img
            .clone()
            .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85, mozjpeg: true })
            .toFile(abs);
        // 打码图：先缩到 64px 再放大回 400px 并模糊，不可逆
        await sharp(buffer)
            .rotate()
            .resize({ width: 64, height: 64, fit: 'inside' })
            .resize({ width: 400, height: 400, fit: 'inside', kernel: 'nearest' })
            .blur(12)
            .jpeg({ quality: 70 })
            .toFile(maskedAbs);
        return {
            path: `/uploads/${rel}`,
            url: `${this.baseUrl}/uploads/${rel}`,
            maskedPath: `/uploads/${maskedRel}`,
            maskedUrl: `${this.baseUrl}/uploads/${maskedRel}`,
            size: buffer.length,
            width: meta.width,
            height: meta.height,
        };
    }
    /** 把存量的相对路径补成完整 URL（DB 里存相对路径，换域名不用洗数据） */
    toAbsoluteUrl(path) {
        if (!path)
            return null;
        if (/^https?:\/\//.test(path))
            return path;
        return `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    }
    validate(buffer, mime) {
        if (!ALLOWED_MIME.has(mime)) {
            throw new Error(`不支持的文件类型：${mime}，仅允许 jpg/png/webp`);
        }
        if (buffer.length > MAX_BYTES) {
            throw new Error(`文件过大：${(buffer.length / 1024 / 1024).toFixed(1)}MB，上限 10MB`);
        }
    }
    buildRelPath(originalName, forceExt) {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const ext = forceExt ?? ((0, node_path_1.extname)(originalName) || '.bin').toLowerCase();
        const hash = (0, node_crypto_1.createHash)('sha1')
            .update(`${Date.now()}${(0, node_crypto_1.randomBytes)(8).toString('hex')}${originalName}`)
            .digest('hex')
            .slice(0, 20);
        return `${yyyy}/${mm}/${hash}${ext}`;
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = StorageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], StorageService);
//# sourceMappingURL=storage.service.js.map