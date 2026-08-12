/**
 * 老系统（PostgreSQL `xq.user_info`）存量客户资料导入。
 *
 * 用法：
 *   1) 先把老库的数据段导成 TSV（\N 表示 NULL，这是 pg 的默认约定）：
 *        pg_restore --data-only -t user_info xiangqin.dump | sed -n '/^COPY/,/^\\\\\.$/p' > /tmp/xq_user_info.tsv
 *      或直接从老库：psql -c "\copy xq.user_info to '/tmp/xq_user_info.tsv'"
 *   2) 照片放到 uploads/legacy/ 下（文件名保持和 photo_url 末段一致）：
 *        rsync -a photos/ <server>:<REMOTE>/uploads/legacy/
 *   3) 跑导入：
 *        npx tsx scripts/import-legacy.ts /tmp/xq_user_info.tsv          # 试跑，不写库
 *        npx tsx scripts/import-legacy.ts /tmp/xq_user_info.tsv --commit # 真写
 *
 * 幂等：以 serialNo = LG{老库id} 作唯一键 upsert，重复跑不会产生重复档案。
 *
 * 注意：TSV 里是真实客户的个人信息，不要提交进仓库，也不要留在共享机器上。
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { PrismaClient, Gender, Education, MaritalStatus, HouseStatus, CarStatus, ProfileStatus, ProfileSource, AuditStatus } from '@prisma/client';

const prisma = new PrismaClient();

/** 老表列顺序，和 xq.user_info 的 DDL 一致 */
const COLUMNS = [
  'id', 'user_name', 'sex', 'birth_place', 'birthday', 'height', 'weight',
  'education', 'marital_status', 'job', 'working_location', 'year_income',
  'car', 'house', 'family_member', 'spouse_standard', 'create_time', 'update_time',
  'photo_url', 'chinese_zodiac', 'contact_info', 'notes', 'info_source',
  'copy_count', 'contact_status', 'push_date', 'inner_code', 'channel_id',
] as const;

type Row = Partial<Record<(typeof COLUMNS)[number], string>>;

// ── 枚举映射 ──
// 老库这几列是自由文本，运营手填了十几种写法，这里穷举收敛。
const EDUCATION_MAP: Record<string, Education> = {
  初中: Education.HIGH_SCHOOL, // 我们没有初中档，向上归到最低档
  高中: Education.HIGH_SCHOOL,
  中专: Education.HIGH_SCHOOL,
  职高: Education.HIGH_SCHOOL,
  大专: Education.JUNIOR_COLLEGE,
  专科: Education.JUNIOR_COLLEGE,
  本科: Education.BACHELOR,
  专升本: Education.BACHELOR,
  专生本: Education.BACHELOR,
  硕士: Education.MASTER,
  研究生: Education.MASTER,
  博士: Education.DOCTOR,
};

const MARITAL_MAP: Record<string, MaritalStatus> = {
  未婚: MaritalStatus.SINGLE,
  离异: MaritalStatus.DIVORCED,
  离婚: MaritalStatus.DIVORCED,
  丧偶: MaritalStatus.WIDOWED,
};

function parseTsv(text: string): Row[] {
  const rows: Row[] = [];
  for (const line of text.split('\n')) {
    // pg 的 COPY 输出以 \. 结尾，前面可能还有 COPY ... FROM stdin; 头
    if (!line || line.startsWith('\\.') || line.startsWith('COPY ')) continue;
    const cells = line.split('\t');
    if (cells.length < COLUMNS.length) continue;
    const row: Row = {};
    COLUMNS.forEach((c, i) => {
      const v = cells[i];
      // \N = NULL；空串和 NULL 在这里等价处理
      if (v != null && v !== '\\N' && v.trim() !== '') {
        row[c] = v.replace(/\\n/g, '\n').replace(/\\t/g, '\t').trim();
      }
    });
    if (row.id) rows.push(row);
  }
  return rows;
}

function num(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 老库 education 是自由文本，先精确命中，再按关键字兜底（"复旦硕士研究生"这类） */
function toEducation(v: string | undefined): Education | null {
  if (!v) return null;
  if (EDUCATION_MAP[v]) return EDUCATION_MAP[v];
  for (const [k, e] of Object.entries(EDUCATION_MAP)) {
    if (v.includes(k)) return e;
  }
  return null;
}

/**
 * 老库 birthday 只有出生年（integer），没有月日。
 * 统一补 7 月 1 日：年中取值，算出来的年龄误差最多半岁，不会系统性偏大或偏小。
 */
function toBirthday(v: string | undefined): Date | null {
  const y = num(v);
  if (y == null || y < 1940 || y > new Date().getFullYear() - 17) return null;
  return new Date(Date.UTC(y, 6, 1));
}

/**
 * 老库 year_income 单位是「万元」，我们的 annualIncome 单位是元。
 * 但运营偶尔按元填（出现过 600 这种既可能是 600 万也可能是笔误的值），
 * 这里按经验阈值切：≤ 200 视为万元，> 200 视为已经是元。
 */
function toIncome(v: string | undefined): number | null {
  const n = num(v);
  if (n == null || n <= 0) return null;
  return n <= 200 ? n * 10000 : n;
}

function toHouse(v: string | undefined): HouseStatus | null {
  if (v === '是') return HouseStatus.FULL_PAID;
  if (v === '否') return HouseStatus.NONE;
  return null;
}

function toCar(v: string | undefined): CarStatus | null {
  if (v === '是') return CarStatus.FULL_PAID;
  if (v === '否') return CarStatus.NONE;
  return null;
}

const PHONE_RE = /1[3-9]\d{9}/;
function toPhone(v: string | undefined): string | null {
  const m = v?.match(PHONE_RE);
  return m ? m[0] : null;
}

/** 从择偶描述里抠出年龄/身高区间。抠不出来就算了，description 原文照样留着给 AI 层用。 */
function parsePreference(text: string | undefined): {
  ageMin: number | null; ageMax: number | null;
  heightMin: number | null; heightMax: number | null;
} {
  const out = { ageMin: null as number | null, ageMax: null as number | null, heightMin: null as number | null, heightMax: null as number | null };
  if (!text) return out;

  // "择偶年龄：99-02" 这种是出生年份后两位，不是年龄，得换算
  const yearRange = text.match(/年龄[：:\s]*(\d{2})\s*[-~到至]\s*(\d{2})(?!\d)/);
  const thisYear = new Date().getFullYear();
  if (yearRange) {
    const toYear = (yy: number) => (yy > 40 ? 1900 + yy : 2000 + yy);
    const a = thisYear - toYear(Number(yearRange[1]));
    const b = thisYear - toYear(Number(yearRange[2]));
    out.ageMin = Math.min(a, b);
    out.ageMax = Math.max(a, b);
  } else {
    const ageRange = text.match(/(\d{2})\s*[-~到至]\s*(\d{2})\s*岁/);
    if (ageRange) { out.ageMin = Number(ageRange[1]); out.ageMax = Number(ageRange[2]); }
    else {
      const upper = text.match(/(\d{2})\s*岁?以[下内]/);
      if (upper) out.ageMax = Number(upper[1]);
    }
  }

  const hRange = text.match(/(1[5-9]\d)\s*[-~到至]\s*(1[5-9]\d)/);
  if (hRange) { out.heightMin = Number(hRange[1]); out.heightMax = Number(hRange[2]); }
  else {
    const hMin = text.match(/(1[5-9]\d)\s*(?:cm|厘米|公分)?\s*以上/);
    if (hMin) out.heightMin = Number(hMin[1]);
  }

  // 明显不合理的（比如把身高当年龄抠出来了）直接丢弃
  if (out.ageMin != null && (out.ageMin < 18 || out.ageMin > 70)) out.ageMin = null;
  if (out.ageMax != null && (out.ageMax < 18 || out.ageMax > 70)) out.ageMax = null;
  return out;
}

/** working_location 是自由文本（"辛集"/"石家庄市长安区"/"辛集五险一金"），只做包含匹配，匹不上就只留文本 */
async function buildRegionMatcher() {
  // 试跑时数据库可能根本没起，这时候只校验解析逻辑，地区码留空
  const regions = await prisma.region.findMany({ orderBy: { level: 'desc' } }).catch(() => {
    console.warn('! 连不上数据库，本次跳过地区码匹配（试跑可忽略）');
    return [] as { code: string; name: string; level: number; parentCode: string | null }[];
  });
  // 长名字优先，避免 "河北" 抢在 "石家庄" 前面命中
  const sorted = regions
    .map((r) => ({ ...r, key: r.name.replace(/[省市区县自治州]/g, '') }))
    .filter((r) => r.key.length >= 2)
    .sort((a, b) => b.key.length - a.key.length);

  return (text: string | undefined) => {
    if (!text) return null;
    return sorted.find((r) => text.includes(r.key)) ?? null;
  };
}

async function main(): Promise<void> {
  const [file, ...flags] = process.argv.slice(2);
  const commit = flags.includes('--commit');
  if (!file) {
    console.error('用法：npx tsx scripts/import-legacy.ts <tsv 路径> [--commit]');
    process.exit(1);
  }

  const rows = parseTsv(readFileSync(file, 'utf8'));
  console.log(`▸ 读到 ${rows.length} 行`);

  const matchRegion = await buildRegionMatcher();
  const stats = { created: 0, updated: 0, skipped: 0, photos: 0, prefs: 0, geo: 0, phone: 0, edu: 0 };
  const skipReasons = new Map<string, number>();
  const skip = (why: string) => {
    stats.skipped++;
    skipReasons.set(why, (skipReasons.get(why) ?? 0) + 1);
  };

  for (const r of rows) {
    const gender = r.sex === '男' ? Gender.MALE : r.sex === '女' ? Gender.FEMALE : null;
    if (!gender) { skip('性别缺失'); continue; }

    const birthday = toBirthday(r.birthday);
    if (!birthday) { skip('出生年缺失或不合理'); continue; }

    const serialNo = `LG${String(r.id).padStart(6, '0')}`;
    const region = matchRegion(r.working_location);
    const hometown = matchRegion(r.birth_place);

    // 家庭情况和备注都是给红娘看的背景信息，拼进自我介绍
    const introduction = [
      r.family_member && `家庭情况：${r.family_member}`,
      r.notes && `备注：${r.notes}`,
    ].filter(Boolean).join('\n\n') || null;

    const data = {
      realName: r.user_name ?? null,
      gender,
      birthday,
      heightCm: num(r.height),
      weightKg: num(r.weight),
      education: toEducation(r.education),
      occupation: r.job ?? null,
      annualIncome: toIncome(r.year_income),
      maritalStatus: MARITAL_MAP[r.marital_status ?? ''] ?? MaritalStatus.SINGLE,
      houseStatus: toHouse(r.house),
      carStatus: toCar(r.car),
      cityCode: region?.code ?? null,
      cityName: r.working_location ?? null,
      provinceCode: region?.level === 1 ? region.code : region?.parentCode ?? null,
      hometownCityCode: hometown?.code ?? null,
      hometownCityName: r.birth_place ?? null,
      introduction,
      phone: toPhone(r.contact_info),
      // 存量客户是运营线下核实过的，直接置为已通过，不要再压一遍审核队列
      status: ProfileStatus.APPROVED,
      source: ProfileSource.IMPORT,
      lastActiveAt: r.update_time ? new Date(r.update_time) : null,
    };

    if (region) stats.geo++;
    if (data.phone) stats.phone++;
    if (data.education) stats.edu++;

    if (!commit) {
      stats.created++;
      if (r.spouse_standard) stats.prefs++;
      if (r.photo_url) stats.photos++;
      continue;
    }

    const existing = await prisma.profile.findUnique({ where: { serialNo }, select: { id: true } });
    const profile = existing
      ? await prisma.profile.update({ where: { id: existing.id }, data })
      : await prisma.profile.create({ data: { ...data, serialNo, createdAt: r.create_time ? new Date(r.create_time) : undefined } });
    existing ? stats.updated++ : stats.created++;

    // ── 择偶要求 ──
    if (r.spouse_standard) {
      const p = parsePreference(r.spouse_standard);
      await prisma.preference.upsert({
        where: { profileId: profile.id },
        create: { profileId: profile.id, ...p, description: r.spouse_standard },
        update: { ...p, description: r.spouse_standard },
      });
      stats.prefs++;
    }

    // ── 照片 ──
    // 老库存的是 http://skmate.com/xq/photos/xxx.jpg，域名已经不在了，
    // 只取文件名，指向我们自己的 /uploads/legacy/
    if (r.photo_url) {
      const url = `/uploads/legacy/${basename(r.photo_url)}`;
      const dup = await prisma.profilePhoto.findFirst({ where: { profileId: profile.id, url } });
      if (!dup) {
        await prisma.profilePhoto.create({
          data: { profileId: profile.id, url, isPrimary: true, auditStatus: AuditStatus.APPROVED, sort: 0 },
        });
        stats.photos++;
      }
    }
  }

  console.log(
    `\n${commit ? '✔ 导入完成' : '（试跑，未写库）'}\n` +
    `  新建 ${stats.created} · 更新 ${stats.updated} · 跳过 ${stats.skipped}\n` +
    `  照片 ${stats.photos} · 择偶要求 ${stats.prefs}\n` +
    `  命中地区码 ${stats.geo} · 解析出手机号 ${stats.phone} · 学历可映射 ${stats.edu}`,
  );
  if (skipReasons.size) {
    console.log('  跳过原因：' + [...skipReasons].map(([k, v]) => `${k} ${v}`).join('，'));
  }
  if (!commit) console.log('\n确认无误后加 --commit 真正写库。');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
