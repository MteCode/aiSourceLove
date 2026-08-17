/**
 * 生成 tabBar 图标。
 *
 *   node scripts/gen-tabbar-icons.mjs
 *
 * 为什么用脚本画而不是放几张 png：图标要两套（未选中灰、选中品牌色），
 * 改主色时手工重导 8 张文件很容易漏掉一两张，颜色就花了。
 * 这里颜色只写一处，跑一遍全部重出。
 *
 * 尺寸取 81×81 —— 微信官方推荐值。
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../src/static/tabbar');

const NORMAL = '#9aa0ab';
const ACTIVE = '#e05a7d';
const SIZE = 81;

/** 线性图标，stroke 统一 5.5，圆头圆角，视觉重量才一致 */
const ICONS = {
  // 广场：四格，代表"一片人"
  square: (c) => `
    <rect x="12" y="12" width="26" height="26" rx="6" fill="none" stroke="${c}" stroke-width="5.5"/>
    <rect x="46" y="12" width="26" height="26" rx="6" fill="none" stroke="${c}" stroke-width="5.5"/>
    <rect x="12" y="46" width="26" height="26" rx="6" fill="none" stroke="${c}" stroke-width="5.5"/>
    <rect x="46" y="46" width="26" height="26" rx="6" fill="none" stroke="${c}" stroke-width="5.5"/>`,

  // 推荐：心 + 星点，暗示"算出来的缘分"
  match: (c) => `
    <path d="M42 68 C42 68 16 52 16 34 C16 24 24 18 32 18 C37 18 41 21 42 24 C43 21 47 18 52 18 C60 18 68 24 68 34 C68 42 62 50 55 56"
          fill="none" stroke="${c}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M64 14 L66.5 20.5 L73 23 L66.5 25.5 L64 32 L61.5 25.5 L55 23 L61.5 20.5 Z" fill="${c}"/>`,

  // 牵线：两环相扣
  intro: (c) => `
    <circle cx="30" cy="42" r="16" fill="none" stroke="${c}" stroke-width="5.5"/>
    <circle cx="54" cy="42" r="16" fill="none" stroke="${c}" stroke-width="5.5"/>`,

  // 我的：头肩
  mine: (c) => `
    <circle cx="42" cy="30" r="14" fill="none" stroke="${c}" stroke-width="5.5"/>
    <path d="M16 72 C16 58 27 50 42 50 C57 50 68 58 68 72"
          fill="none" stroke="${c}" stroke-width="5.5" stroke-linecap="round"/>`,
};

async function main() {
  await mkdir(OUT, { recursive: true });
  let n = 0;
  for (const [name, draw] of Object.entries(ICONS)) {
    for (const [suffix, color] of [['', NORMAL], ['-on', ACTIVE]]) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 84 84" width="${SIZE}" height="${SIZE}">${draw(color)}</svg>`;
      const file = join(OUT, `${name}${suffix}.png`);
      await sharp(Buffer.from(svg)).png().toFile(file);
      n++;
    }
  }
  console.log(`✔ 生成 ${n} 个图标 → src/static/tabbar/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
