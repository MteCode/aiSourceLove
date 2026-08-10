import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { AppConfig } from '@/config/configuration';

export interface StoredFile {
  /** 相对路径，如 /uploads/2026/08/xxx.jpg */
  path: string;
  /** 可访问的完整 URL */
  url: string;
  size: number;
  width?: number;
  height?: number;
}

export interface StoredPhoto extends StoredFile {
  /** 打码版本的 URL。模块4：照片默认打码，没权限的人只拿这个。 */
  maskedUrl: string;
  maskedPath: string;
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * 本地文件存储 + 照片打码。
 *
 * 生产上量后换 OSS/COS：把 save* 换成 SDK 调用即可，接口不变。
 * 打码这一步不能放前端——前端打码等于没打，抓包就拿到原图了。
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    this.uploadDir = this.config.get('storage', { infer: true }).uploadDir;
    this.baseUrl = this.config.get('publicBaseUrl', { infer: true });
  }

  /** 存普通文件 */
  async saveFile(buffer: Buffer, originalName: string, mime: string): Promise<StoredFile> {
    this.validate(buffer, mime);
    const rel = this.buildRelPath(originalName);
    const abs = join(this.uploadDir, rel);
    await mkdir(join(abs, '..'), { recursive: true });
    await writeFile(abs, buffer);
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
  async savePhoto(buffer: Buffer, originalName: string, mime: string): Promise<StoredPhoto> {
    this.validate(buffer, mime);

    // sharp 是原生模块，装不上时不能让整个上传功能挂掉
    let sharp: typeof import('sharp');
    try {
      sharp = (await import('sharp')).default as unknown as typeof import('sharp');
    } catch (e) {
      this.logger.error(`sharp 不可用，照片将不做压缩与打码：${(e as Error).message}`);
      const f = await this.saveFile(buffer, originalName, mime);
      return { ...f, maskedUrl: f.url, maskedPath: f.path };
    }

    const rel = this.buildRelPath(originalName, '.jpg');
    const maskedRel = rel.replace(/\.jpg$/, '_masked.jpg');
    const abs = join(this.uploadDir, rel);
    const maskedAbs = join(this.uploadDir, maskedRel);
    await mkdir(join(abs, '..'), { recursive: true });

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
  toAbsoluteUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    if (/^https?:\/\//.test(path)) return path;
    return `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  private validate(buffer: Buffer, mime: string): void {
    if (!ALLOWED_MIME.has(mime)) {
      throw new Error(`不支持的文件类型：${mime}，仅允许 jpg/png/webp`);
    }
    if (buffer.length > MAX_BYTES) {
      throw new Error(`文件过大：${(buffer.length / 1024 / 1024).toFixed(1)}MB，上限 10MB`);
    }
  }

  private buildRelPath(originalName: string, forceExt?: string): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const ext = forceExt ?? (extname(originalName) || '.bin').toLowerCase();
    const hash = createHash('sha1')
      .update(`${Date.now()}${randomBytes(8).toString('hex')}${originalName}`)
      .digest('hex')
      .slice(0, 20);
    return `${yyyy}/${mm}/${hash}${ext}`;
  }
}
