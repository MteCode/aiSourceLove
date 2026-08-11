"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const compression_1 = __importDefault(require("compression"));
const helmet_1 = __importDefault(require("helmet"));
const node_fs_1 = require("node:fs");
const app_module_1 = require("./app.module");
const prisma_service_1 = require("./infra/prisma/prisma.service");
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        // 微信支付回调要验签，必须拿到未经解析的原始报文
        rawBody: true,
        logger: ['error', 'warn', 'log', 'debug'],
    });
    const config = app.get((config_1.ConfigService));
    const port = config.get('port', { infer: true });
    const apiPrefix = config.get('apiPrefix', { infer: true });
    const isProd = config.get('isProd', { infer: true });
    const uploadDir = config.get('storage', { infer: true }).uploadDir;
    (0, node_fs_1.mkdirSync)(uploadDir, { recursive: true });
    app.setGlobalPrefix(apiPrefix, {
        // 上传的静态文件不走 /api 前缀
        exclude: ['uploads/(.*)', 'health'],
    });
    app.use((0, helmet_1.default)({
        // 图片要被小程序/H5 跨域引用
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        contentSecurityPolicy: false,
    }));
    app.use((0, compression_1.default)());
    app.enableCors({
        // 生产环境请在 Nginx 层收紧到具体域名；这里放开是为了小程序和本地调试
        origin: true,
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true, // 剔除 DTO 里没声明的字段
        forbidNonWhitelisted: false,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        validationError: { target: false, value: false },
    }));
    const prisma = app.get(prisma_service_1.PrismaService);
    prisma.enableShutdownHooks(app);
    app.enableShutdownHooks();
    // Swagger：生产环境默认关掉，避免把接口结构暴露出去
    if (!isProd || process.env.ENABLE_SWAGGER === 'true') {
        const doc = new swagger_1.DocumentBuilder()
            .setTitle('缘桥 API')
            .setDescription('相亲/婚恋撮合平台。六大模块：录入系统、AI 匹配、红娘系统、隐私分级、VIP 充值、后台管理。')
            .setVersion('0.1.0')
            .addBearerAuth()
            .build();
        swagger_1.SwaggerModule.setup(`${apiPrefix}/docs`, app, swagger_1.SwaggerModule.createDocument(app, doc), {
            swaggerOptions: { persistAuthorization: true },
        });
    }
    await app.listen(port, '0.0.0.0');
    logger.log('─'.repeat(56));
    logger.log(`  缘桥 API 已启动`);
    logger.log(`  环境      ${config.get('env', { infer: true })}`);
    logger.log(`  接口      http://localhost:${port}${apiPrefix}`);
    if (!isProd || process.env.ENABLE_SWAGGER === 'true') {
        logger.log(`  文档      http://localhost:${port}${apiPrefix}/docs`);
    }
    logger.log(`  AI        ${config.get('ai', { infer: true }).provider}`);
    logger.log(`  支付      ${config.get('pay', { infer: true }).provider}`);
    logger.log('─'.repeat(56));
}
void bootstrap();
//# sourceMappingURL=main.js.map