/**
 * 档案向量批量预热。
 *
 *   npx tsx scripts/warm-embeddings.ts            只算缺的和模型对不上的
 *   npx tsx scripts/warm-embeddings.ts --all      全部重算
 *   npx tsx scripts/warm-embeddings.ts --limit 50 只算前 50 份（试水用）
 *
 * 为什么要有它：匹配时是懒加载——谁被匹配到才算谁。存量 500+ 份档案时，
 * 第一个用户会替所有人承担补算成本，请求要等几十秒。上线前先把这一步跑掉。
 *
 * 可中断可重跑：每批算完立刻落库，中途 Ctrl+C 不会丢已完成的部分。
 *
 * 不走 Nest：脚本用 tsx 直接跑 TS，esbuild 不生成 design:paramtypes，
 * Nest 的依赖注入在这里是失效的。provider 的选择逻辑走 createAiProviders，
 * 和线上共用同一份，不会跑偏。
 */
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { join } from 'node:path';
import configuration from '../src/config/configuration';
import { createAiProviders } from '../src/infra/ai/ai.provider';

loadEnv({ path: join(__dirname, '../../../.env') });

/** 每次落库多少份档案。一份档案 = 2 条文本（自我介绍 + 择偶描述） */
const CHUNK = 20;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const redoAll = args.includes('--all');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : undefined;

  const prisma = new PrismaClient();
  const { embed: provider, embedNote } = createAiProviders(configuration().ai);
  const modelId = provider.embeddingModelId;
  console.log(`▸ 向量通道：${embedNote}`);
  console.log(`▸ 模型标识：${modelId}`);

  const where = {
    deletedAt: null,
    ...(redoAll
      ? {}
      : {
          OR: [
            { embeddingUpdatedAt: null },
            { embeddingModel: null },
            { embeddingModel: { not: modelId } },
          ],
        }),
  };

  const targets = await prisma.profile.findMany({
    where,
    select: {
      id: true,
      serialNo: true,
      introduction: true,
      preference: { select: { description: true } },
    },
    orderBy: { createdAt: 'asc' },
    ...(limit ? { take: limit } : {}),
  });

  const total = await prisma.profile.count({ where: { deletedAt: null } });
  console.log(`▸ 待处理 ${targets.length} / 共 ${total} 份档案`);
  if (!targets.length) {
    console.log('  没有需要处理的，退出。');
    await prisma.$disconnect();
    return;
  }

  const started = Date.now();
  let done = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i += CHUNK) {
    const batch = targets.slice(i, i + CHUNK);
    const texts: string[] = [];
    for (const p of batch) {
      texts.push(p.introduction?.trim() || '暂无自我介绍');
      texts.push(p.preference?.description?.trim() || '暂无择偶描述');
    }

    let vectors: number[][];
    try {
      vectors = await provider.embed(texts);
    } catch (e) {
      // provider 内部已经对 429/5xx 重试过了，还失败就是配置或额度问题，继续跑也是白跑
      console.error(
        `\n✘ 第 ${Math.floor(i / CHUNK) + 1} 批失败：${(e as Error).message}\n` +
          `  已完成的部分都已落库，修好后重跑本脚本会从断点继续。`,
      );
      failed = targets.length - done;
      break;
    }

    const now = new Date();
    await prisma.$transaction(
      batch.map((p, k) =>
        prisma.profile.update({
          where: { id: p.id },
          data: {
            introEmbedding: vectors[k * 2],
            prefEmbedding: vectors[k * 2 + 1],
            embeddingUpdatedAt: now,
            embeddingModel: modelId,
          },
        }),
      ),
    );

    done += batch.length;
    const pct = ((done / targets.length) * 100).toFixed(0);
    const elapsed = (Date.now() - started) / 1000;
    const eta = elapsed / done * (targets.length - done);
    process.stdout.write(
      `\r  ${done}/${targets.length}（${pct}%） 已用 ${elapsed.toFixed(0)}s，预计还需 ${eta.toFixed(0)}s   `,
    );
  }

  console.log(
    `\n${failed ? '⚠ 部分完成' : '✔ 完成'}：${done} 份已写入向量` + (failed ? `，${failed} 份未处理` : ''),
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
