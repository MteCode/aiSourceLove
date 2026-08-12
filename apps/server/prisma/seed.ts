/**
 * 缘桥 种子数据
 *
 * 幂等：全部用 upsert，可以反复执行。
 * 内容：权限点 → 角色 → 管理员账号 → 行政区划 → 字段字典 → VIP 套餐 → 演示数据
 *
 * 执行：npm run db:seed -w @yuanqiao/server
 * 只建基础数据不建演示数据：SEED_DEMO=false npm run db:seed -w @yuanqiao/server
 */

import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { REGIONS } from './regions';

const prisma = new PrismaClient();
const SEED_DEMO = process.env.SEED_DEMO !== 'false';

// ═══════════════════════════════════════════
//  1. 权限点
// ═══════════════════════════════════════════

const PERMISSIONS: { code: string; name: string; module: string }[] = [
  // 会员
  { code: 'profile:list', name: '查看会员', module: '会员管理' },
  { code: 'profile:edit', name: '编辑会员', module: '会员管理' },
  { code: 'profile:audit', name: '审核会员资料与照片', module: '会员管理' },
  { code: 'profile:delete', name: '删除会员', module: '会员管理' },
  // 字段字典
  { code: 'field:list', name: '查看字段配置', module: '字段字典' },
  { code: 'field:edit', name: '编辑字段配置', module: '字段字典' },
  // 红娘
  { code: 'matchmaker:list', name: '查看红娘', module: '红娘管理' },
  { code: 'matchmaker:review', name: '审核红娘入驻', module: '红娘管理' },
  { code: 'commission:list', name: '查看分润', module: '红娘管理' },
  { code: 'commission:settle', name: '手动结算分润', module: '红娘管理' },
  { code: 'withdrawal:list', name: '查看提现', module: '红娘管理' },
  { code: 'withdrawal:review', name: '审核提现', module: '红娘管理' },
  // 交易
  { code: 'vip:manage', name: '管理 VIP 套餐', module: '交易管理' },
  { code: 'order:list', name: '查看订单', module: '交易管理' },
  { code: 'order:refund', name: '订单退款', module: '交易管理' },
  // 系统
  { code: 'dashboard:view', name: '查看数据看板', module: '系统管理' },
  { code: 'system:user:list', name: '查看用户', module: '系统管理' },
  { code: 'system:user:edit', name: '编辑用户', module: '系统管理' },
  { code: 'system:role:list', name: '查看角色', module: '系统管理' },
  { code: 'system:role:edit', name: '编辑角色权限', module: '系统管理' },
  { code: 'system:log:list', name: '查看操作日志', module: '系统管理' },
];

/** 角色 → 权限。SUPER_ADMIN 不列，代码里直通所有权限。 */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: PERMISSIONS.map((p) => p.code).filter((c) => !c.startsWith('system:role')),
  AUDITOR: ['profile:list', 'profile:audit', 'dashboard:view'],
  MATCHMAKER: ['profile:list', 'matchmaker:list', 'commission:list', 'withdrawal:list'],
  MEMBER: [],
};

const ROLES = [
  { code: 'SUPER_ADMIN', name: '超级管理员', description: '拥有全部权限，不可删除', sort: 0 },
  { code: 'ADMIN', name: '管理员', description: '除角色权限配置外的所有业务权限', sort: 1 },
  { code: 'AUDITOR', name: '审核员', description: '只能审核会员资料与照片', sort: 2 },
  { code: 'MATCHMAKER', name: '红娘', description: '管理名下会员、发起牵线、查看分润', sort: 3 },
  { code: 'MEMBER', name: '普通会员', description: 'C 端用户', sort: 4 },
];

// ═══════════════════════════════════════════
//  2. 行政区划（省份 + 主要城市 + 河北/京津区县）
// ═══════════════════════════════════════════

// 区划数据见 ./regions.ts（导入脚本也要用，所以单独成文件）

// ═══════════════════════════════════════════
//  3. 字段字典
// ═══════════════════════════════════════════

const FIELD_GROUPS = [
  { code: 'basic', name: '基本信息', sort: 1 },
  { code: 'career', name: '工作学业', sort: 2 },
  { code: 'family', name: '家庭情况', sort: 3 },
  { code: 'contact', name: '联系方式', sort: 4 },
  { code: 'extra', name: '补充信息', sort: 5 },
  { code: 'preference', name: '择偶要求', sort: 6 },
];

type FieldSeed = {
  code: string; label: string; type: string; group: string;
  visibility: number; isCore: boolean; required?: boolean;
  isPreference?: boolean; weightKey?: string; sort: number;
  options?: { value: string; label: string; score?: number }[];
  placeholder?: string; helpText?: string;
  minValue?: number; maxValue?: number; maxLength?: number;
};

const FIELDS: FieldSeed[] = [
  // ── 基本信息（isCore=映射 Profile 固定列）──
  { code: 'realName', label: '真实姓名', type: 'TEXT', group: 'basic', visibility: 3, isCore: true, required: true, sort: 1, maxLength: 20, helpText: '仅红娘和已解锁的人可见，列表页显示为「张*」' },
  { code: 'nickname', label: '昵称', type: 'TEXT', group: 'basic', visibility: 0, isCore: true, sort: 2, maxLength: 20 },
  { code: 'gender', label: '性别', type: 'SELECT', group: 'basic', visibility: 0, isCore: true, required: true, sort: 3, options: [{ value: 'MALE', label: '男' }, { value: 'FEMALE', label: '女' }] },
  { code: 'birthday', label: '出生日期', type: 'DATE', group: 'basic', visibility: 2, isCore: true, required: true, sort: 4, helpText: '列表只展示年龄，具体生日 VIP 可见' },
  { code: 'heightCm', label: '身高(cm)', type: 'NUMBER', group: 'basic', visibility: 0, isCore: true, sort: 5, minValue: 140, maxValue: 220, weightKey: 'height', isPreference: true },
  { code: 'weightKg', label: '体重(kg)', type: 'NUMBER', group: 'basic', visibility: 1, isCore: true, sort: 6, minValue: 30, maxValue: 200 },
  { code: 'cityCode', label: '常住城市', type: 'REGION', group: 'basic', visibility: 0, isCore: true, required: true, sort: 7, weightKey: 'distance', isPreference: true },
  { code: 'hometownCityCode', label: '籍贯', type: 'REGION', group: 'basic', visibility: 1, isCore: true, sort: 8 },
  { code: 'introduction', label: '自我介绍', type: 'TEXTAREA', group: 'basic', visibility: 1, isCore: true, sort: 9, maxLength: 2000, placeholder: '介绍一下自己的性格、生活状态、兴趣', helpText: 'AI 匹配会用这段话做语义分析，写得越具体推荐越准' },

  // ── 工作学业 ──
  { code: 'education', label: '学历', type: 'SELECT', group: 'career', visibility: 0, isCore: true, required: true, sort: 1, weightKey: 'education', isPreference: true, options: [
    { value: 'PRIMARY_SCHOOL', label: '小学', score: 1 },
    { value: 'JUNIOR_HIGH', label: '初中', score: 2 },
    { value: 'HIGH_SCHOOL', label: '高中', score: 3 },
    { value: 'JUNIOR_COLLEGE', label: '专科', score: 4 },
    { value: 'BACHELOR', label: '本科', score: 5 },
    { value: 'MASTER', label: '硕士', score: 6 },
    { value: 'DOCTOR', label: '博士', score: 7 },
  ] },
  { code: 'school', label: '毕业院校', type: 'TEXT', group: 'career', visibility: 2, isCore: true, sort: 2, maxLength: 50 },
  { code: 'occupation', label: '职业', type: 'TEXT', group: 'career', visibility: 1, isCore: true, sort: 3, maxLength: 50 },
  { code: 'company', label: '工作单位', type: 'TEXT', group: 'career', visibility: 2, isCore: true, sort: 4, maxLength: 50, helpText: '涉及隐私，默认 VIP 才可见' },
  { code: 'annualIncome', label: '年收入(元)', type: 'NUMBER', group: 'career', visibility: 2, isCore: true, sort: 5, minValue: 0, weightKey: 'income', isPreference: true },

  // ── 家庭情况 ──
  { code: 'maritalStatus', label: '婚姻状况', type: 'SELECT', group: 'family', visibility: 1, isCore: true, required: true, sort: 1, isPreference: true, options: [
    { value: 'SINGLE', label: '未婚' }, { value: 'DIVORCED', label: '离异' }, { value: 'WIDOWED', label: '丧偶' },
  ] },
  { code: 'childrenStatus', label: '子女情况', type: 'SELECT', group: 'family', visibility: 1, isCore: true, sort: 2, isPreference: true, options: [
    { value: 'NONE', label: '无子女' }, { value: 'WITH_SELF', label: '有，随自己' }, { value: 'WITH_OTHER', label: '有，不随自己' },
  ] },
  { code: 'houseStatus', label: '房产', type: 'SELECT', group: 'family', visibility: 2, isCore: true, sort: 3, isPreference: true, options: [
    { value: 'NONE', label: '暂无' }, { value: 'MORTGAGE', label: '按揭' }, { value: 'FULL_PAID', label: '全款' },
  ] },
  { code: 'carStatus', label: '车产', type: 'SELECT', group: 'family', visibility: 2, isCore: true, sort: 4, isPreference: true, options: [
    { value: 'NONE', label: '暂无' }, { value: 'MORTGAGE', label: '按揭' }, { value: 'FULL_PAID', label: '全款' },
  ] },

  // ── 联系方式（命门，默认解锁后才可见）──
  { code: 'phone', label: '手机号', type: 'TEXT', group: 'contact', visibility: 3, isCore: true, required: true, sort: 1, helpText: '未解锁的人只能看到 138****8888' },
  { code: 'wechat', label: '微信号', type: 'TEXT', group: 'contact', visibility: 3, isCore: true, sort: 2 },

  // ── 补充信息（EAV，运营可随时增删，不用改表不用发版）──
  { code: 'hobby', label: '兴趣爱好', type: 'MULTI_SELECT', group: 'extra', visibility: 1, isCore: false, sort: 1, options: [
    { value: 'travel', label: '旅行' }, { value: 'fitness', label: '健身' }, { value: 'reading', label: '阅读' },
    { value: 'music', label: '音乐' }, { value: 'movie', label: '电影' }, { value: 'cooking', label: '烹饪' },
    { value: 'pet', label: '养宠' }, { value: 'game', label: '游戏' }, { value: 'photography', label: '摄影' },
    { value: 'outdoor', label: '户外' },
  ] },
  { code: 'smoking', label: '吸烟', type: 'SELECT', group: 'extra', visibility: 1, isCore: false, sort: 2, options: [
    { value: 'never', label: '不吸' }, { value: 'sometimes', label: '偶尔' }, { value: 'often', label: '经常' },
  ] },
  { code: 'drinking', label: '饮酒', type: 'SELECT', group: 'extra', visibility: 1, isCore: false, sort: 3, options: [
    { value: 'never', label: '不喝' }, { value: 'social', label: '应酬时' }, { value: 'often', label: '经常' },
  ] },
  { code: 'acceptLongDistance', label: '接受异地', type: 'BOOLEAN', group: 'extra', visibility: 1, isCore: false, sort: 4 },
  { code: 'wantChildren', label: '婚后要孩子', type: 'SELECT', group: 'extra', visibility: 1, isCore: false, sort: 5, options: [
    { value: 'yes', label: '想要' }, { value: 'no', label: '不想要' }, { value: 'undecided', label: '看情况' },
  ] },
  { code: 'liveWithParents', label: '婚后与父母同住', type: 'SELECT', group: 'extra', visibility: 1, isCore: false, sort: 6, options: [
    { value: 'yes', label: '接受' }, { value: 'no', label: '不接受' }, { value: 'undecided', label: '看情况' },
  ] },
];

// ═══════════════════════════════════════════
//  4. VIP 套餐
// ═══════════════════════════════════════════

const PACKAGES = [
  {
    name: '体验卡', subtitle: '先试试水', price: 1900, originalPrice: 2900, durationDays: 7, sort: 1,
    benefits: [
      { code: 'VIEW_PROFILE', quota: 10, cycle: 'DAILY' },
      { code: 'UNLOCK_CONTACT', quota: 2, cycle: 'NONE' },
      { code: 'ADVANCED_FILTER', quota: 20, cycle: 'DAILY' },
    ],
  },
  {
    name: '月卡', subtitle: '最多人选择', price: 9900, originalPrice: 19900, durationDays: 30, sort: 2, isRecommended: true,
    benefits: [
      { code: 'VIEW_PROFILE', quota: 30, cycle: 'DAILY' },
      { code: 'UNLOCK_CONTACT', quota: 10, cycle: 'NONE' },
      { code: 'AI_MATCH', quota: 5, cycle: 'DAILY' },
      { code: 'SEE_VISITORS', quota: 20, cycle: 'DAILY' },
      { code: 'ADVANCED_FILTER', quota: 50, cycle: 'DAILY' },
      { code: 'TOP_EXPOSURE', quota: 3, cycle: 'NONE' },
    ],
  },
  {
    name: '季卡', subtitle: '省 40%', price: 24900, originalPrice: 59700, durationDays: 90, sort: 3,
    benefits: [
      { code: 'VIEW_PROFILE', quota: 50, cycle: 'DAILY' },
      { code: 'UNLOCK_CONTACT', quota: 40, cycle: 'NONE' },
      { code: 'AI_MATCH', quota: 15, cycle: 'DAILY' },
      { code: 'SEE_VISITORS', quota: 50, cycle: 'DAILY' },
      { code: 'ADVANCED_FILTER', quota: 100, cycle: 'DAILY' },
      { code: 'TOP_EXPOSURE', quota: 15, cycle: 'NONE' },
    ],
  },
  {
    name: '年卡', subtitle: '认真找对象', price: 79900, originalPrice: 238800, durationDays: 365, sort: 4,
    benefits: [
      { code: 'VIEW_PROFILE', quota: 100, cycle: 'DAILY' },
      { code: 'UNLOCK_CONTACT', quota: 200, cycle: 'NONE' },
      { code: 'AI_MATCH', quota: 30, cycle: 'DAILY' },
      { code: 'SEE_VISITORS', quota: 100, cycle: 'DAILY' },
      { code: 'ADVANCED_FILTER', quota: 200, cycle: 'DAILY' },
      { code: 'TOP_EXPOSURE', quota: 60, cycle: 'NONE' },
    ],
  },
];

// ═══════════════════════════════════════════
//  演示数据素材
// ═══════════════════════════════════════════

const SURNAMES = '王李张刘陈杨黄赵周吴徐孙马朱胡林郭何高罗郑梁谢宋唐许邓冯韩曹曾彭萧蔡潘田董袁于余叶蒋杜苏魏程吕丁沈任姚卢傅钟姜崔谭廖范汪陆金石戴贾韦夏邱方侯邹熊孟秦白江阎薛尹段雷黎史龙陶贺顾毛郝龚邵万钱严覃武戚莫孔向汤'.split('');
const MALE_NAMES = ['浩然', '子轩', '宇航', '俊杰', '文博', '嘉豪', '志强', '建国', '晓峰', '天翊', '思远', '明轩', '瑞霖', '子墨', '锦程', '博文', 'junjie', '一鸣', '泽宇', '梓豪'];
const FEMALE_NAMES = ['雨萱', '欣怡', '梓涵', '思琪', '诗涵', '晓melody', '若曦', '语嫣', '雅静', 'ee佳怡', '梦琪', '子萱', '嘉懿', '菁菁', '婉清', '芷若', '心怡', '静姝', '沐辰', 'book佳琪'];
const OCCUPATIONS_M = ['软件工程师', '产品经理', '土木工程师', '医生', '教师', '公务员', '销售经理', '会计师', '律师', '建筑设计师', '汽车维修技师', '厨师', '金融分析师', '运营总监', '机械工程师'];
const OCCUPATIONS_F = ['小学教师', '护士', '会计', 'UI设计师', '人力资源专员', '公务员', '医生', '编辑', '幼师', '市场专员', '药剂师', '银行柜员', '心理咨询师', '翻译', '行政主管'];
const SCHOOLS = ['浙江大学', '武汉大学', '四川大学', '南京大学', '中山大学', '厦门大学', '山东大学', '郑州大学', '湖南大学', '西安交通大学', '合肥工业大学', '南京师范大学', '广东工业大学', '杭州电子科技大学', '本地师范学院'];
const INTRO_M = [
  '性格比较稳，不太会说甜言蜜语，但答应的事一定做到。周末喜欢骑车或者在家做饭，希望找个能一起过安稳日子的人。',
  '工作忙但作息规律，不抽烟不喝酒。喜欢看书和跑步，参加过两次半马。想找三观正、能好好沟通的另一半。',
  '家里独子，父母都退休了有养老金，不需要负担。自己有套小两居按揭中。喜欢摄影和露营，希望对方也爱出去走走。',
  '在体制内上班，收入不高但稳定，能顾家。会做几个拿手菜。不喜欢应酬，下班就回家。希望找个踏实过日子的人。',
  '创业过也失败过，现在在一家公司做技术。经历过一些事，比较珍惜眼前人。喜欢安静，也愿意陪对方热闹。',
  '身高178，健身三年了。做销售的，性格外向朋友多。想找个性格互补、安静一点的女生。',
  '离异无孩，前段婚姻是性格不合和平分开的。不想将就也不想耽误别人，希望坦诚沟通。',
];
const INTRO_F = [
  '性格温和但有主见，喜欢做饭和养多肉。工作稳定不加班，有充足时间经营生活。希望对方有责任心，能一起商量事情。',
  '爱看书爱旅行，去过十几个省份。不太会撒娇，但心里有事会直说。希望找个成熟稳重、能包容我偶尔小情绪的人。',
  '在医院上班，倒班比较辛苦，所以更希望对方能理解和支持。业余喜欢烘焙和拼图。不介意对方收入，介意不上进。',
  '家里有个弟弟已成家，父母身体都好。我自己有房无贷。喜欢安静的相处方式，不喜欢查手机那种。',
  '老师，寒暑假比较长，喜欢利用假期出去走走。养了一只猫。希望对方不排斥宠物，最好也喜欢小动物。',
  '性格开朗爱笑，朋友说我情绪价值很高。做设计的，有点完美主义。想找个能聊得来、有共同话题的人。',
  '独立带孩子三年了，孩子跟我。不急着找，但如果遇到合适的人，希望他能真心对孩子好。',
];
const PREF_DESC_M = [
  '希望对方性格温和一点，能好好说话。不要求高收入，但要有自己的事业心。最好在本市，异地太难维持。',
  '喜欢干净整洁、爱生活的女生。年龄比我小一点最好。希望婚后能一起承担家庭责任，不做甩手掌柜。',
  '要求不高：三观正、身体健康、对家人好。如果爱运动或者爱看书就更好了，能有共同话题。',
];
const PREF_DESC_F = [
  '希望对方成熟稳重，有稳定工作和收入。不需要大富大贵，但要上进。最重要的是脾气好，遇事能沟通不冷暴力。',
  '希望是本地人或者愿意在本地定居的。有房无贷最好，按揭也可以。不接受吸烟和有不良嗜好的。',
  '想找个身高175以上、性格阳光的。学历最好本科以上，能聊到一块去。孝顺但不愚孝，有自己的判断。',
];

const CITIES = REGIONS.filter((r) => r.level === 2);

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}
function rand(seed: number, min: number, max: number): number {
  // 确定性伪随机：同样的 seed 永远得到同样的数据，方便复现问题
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  const f = x - Math.floor(x);
  return Math.floor(min + f * (max - min + 1));
}

// ═══════════════════════════════════════════

async function seedPermissionsAndRoles() {
  console.log('▸ 权限点与角色…');
  for (const [i, p] of PERMISSIONS.entries()) {
    await prisma.permission.upsert({
      where: { code: p.code },
      create: { ...p, sort: i },
      update: { name: p.name, module: p.module, sort: i },
    });
  }

  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { code: r.code },
      create: { ...r, isBuiltin: true },
      update: { name: r.name, description: r.description, sort: r.sort },
    });

    const codes = ROLE_PERMISSIONS[r.code];
    if (!codes) continue; // SUPER_ADMIN 走代码直通
    const perms = await prisma.permission.findMany({ where: { code: { in: codes } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (perms.length) {
      await prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }
  }
  console.log(`  ${PERMISSIONS.length} 个权限点，${ROLES.length} 个角色`);
}

async function seedAdmin() {
  console.log('▸ 管理员账号…');
  const phone = process.env.ADMIN_USERNAME ?? 'admin';
  const password = process.env.ADMIN_PASSWORD ?? 'Admin@123456';
  // admin 不是手机号，但 User.phone 是唯一登录标识，这里直接用它当账号
  const superRole = await prisma.role.findUniqueOrThrow({ where: { code: 'SUPER_ADMIN' } });

  const user = await prisma.user.upsert({
    where: { phone },
    create: {
      phone,
      nickname: '超级管理员',
      passwordHash: await bcrypt.hash(password, 10),
      roles: { create: { roleId: superRole.id } },
    },
    update: { passwordHash: await bcrypt.hash(password, 10) },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: superRole.id } },
    create: { userId: user.id, roleId: superRole.id },
    update: {},
  });
  console.log(`  账号 ${phone} / 密码 ${password}`);
}

async function seedRegions() {
  console.log('▸ 行政区划…');
  for (const [i, r] of REGIONS.entries()) {
    await prisma.region.upsert({
      where: { code: r.code },
      create: {
        code: r.code, name: r.name, level: r.level,
        parentCode: r.parent ?? null, lat: r.lat, lng: r.lng, sort: i,
      },
      update: { name: r.name, lat: r.lat, lng: r.lng, sort: i },
    });
  }
  console.log(`  ${REGIONS.length} 条（省份 + 主要城市 + 河北/京津区县）`);
}

async function seedFields() {
  console.log('▸ 字段字典…');
  const groupIds = new Map<string, string>();
  for (const g of FIELD_GROUPS) {
    const row = await prisma.fieldGroup.upsert({
      where: { code: g.code },
      create: g,
      update: { name: g.name, sort: g.sort },
    });
    groupIds.set(g.code, row.id);
  }

  for (const f of FIELDS) {
    const groupId = groupIds.get(f.group);
    if (!groupId) continue;
    const data = {
      label: f.label,
      type: f.type as never,
      groupId,
      options: (f.options ?? undefined) as Prisma.InputJsonValue | undefined,
      placeholder: f.placeholder,
      helpText: f.helpText,
      required: f.required ?? false,
      visibility: f.visibility,
      isCore: f.isCore,
      isPreference: f.isPreference ?? false,
      weightKey: f.weightKey,
      minValue: f.minValue,
      maxValue: f.maxValue,
      maxLength: f.maxLength,
      sort: f.sort,
      enabled: true,
    };
    await prisma.fieldDef.upsert({
      where: { code: f.code },
      create: { code: f.code, ...data },
      update: data,
    });
  }
  console.log(`  ${FIELD_GROUPS.length} 个分组，${FIELDS.length} 个字段（${FIELDS.filter((f) => !f.isCore).length} 个走 EAV，可随时增删）`);
}

async function seedPackages() {
  console.log('▸ VIP 套餐…');
  for (const p of PACKAGES) {
    const existing = await prisma.vipPackage.findFirst({ where: { name: p.name } });
    const data = {
      name: p.name,
      subtitle: p.subtitle,
      price: p.price,
      originalPrice: p.originalPrice,
      durationDays: p.durationDays,
      benefits: p.benefits as unknown as Prisma.InputJsonValue,
      isRecommended: p.isRecommended ?? false,
      sort: p.sort,
      enabled: true,
    };
    if (existing) await prisma.vipPackage.update({ where: { id: existing.id }, data });
    else await prisma.vipPackage.create({ data });
  }
  console.log(`  ${PACKAGES.length} 个套餐`);
}

async function seedDemo() {
  console.log('▸ 演示数据…');
  const memberRole = await prisma.role.findUniqueOrThrow({ where: { code: 'MEMBER' } });
  const mmRole = await prisma.role.findUniqueOrThrow({ where: { code: 'MATCHMAKER' } });
  const pwd = await bcrypt.hash('Demo@123456', 10);

  // ── 3 位红娘 ──
  const matchmakers: { id: string; cityCode: string }[] = [];
  const mmSeeds = [
    { phone: '13900000001', name: '王月老', city: '440300', cityName: '深圳市', bio: '深耕深圳婚恋 8 年，服务过 2000+ 会员，擅长互联网从业者匹配。' },
    { phone: '13900000002', name: '李红娘', name2: true, city: '330100', cityName: '杭州市', bio: '杭州本地红娘，主做体制内和教师群体，线下相亲会每月两场。' },
    { phone: '13900000003', name: '张姐', city: '510100', cityName: '成都市', bio: '成都资深媒人，注重人品考察，只推真实靠谱的资料。' },
  ];
  for (const m of mmSeeds) {
    const u = await prisma.user.upsert({
      where: { phone: m.phone },
      create: { phone: m.phone, nickname: m.name, passwordHash: pwd, roles: { create: { roleId: mmRole.id } } },
      update: { passwordHash: pwd },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: u.id, roleId: mmRole.id } },
      create: { userId: u.id, roleId: mmRole.id },
      update: {},
    });
    const mm = await prisma.matchmaker.upsert({
      where: { userId: u.id },
      create: {
        userId: u.id, name: m.name, phone: m.phone,
        cityCode: m.city, cityName: m.cityName, bio: m.bio,
        status: 'ACTIVE', commissionRate: new Prisma.Decimal(0.2),
      },
      update: { status: 'ACTIVE', bio: m.bio },
    });
    matchmakers.push({ id: mm.id, cityCode: m.city });
  }

  // ── 40 份会员档案 ──
  // 男女各 20，年龄 24-40，分布在几个主要城市，让匹配引擎有东西可算
  const COUNT = 40;
  let created = 0;
  for (let i = 0; i < COUNT; i++) {
    const isMale = i % 2 === 0;
    const idx = Math.floor(i / 2);
    const phone = `1370000${String(1000 + i).slice(-4)}`;

    const existing = await prisma.profile.findFirst({ where: { phone } });
    if (existing) continue;

    const city = pick(CITIES, rand(i + 7, 0, CITIES.length - 1));
    const age = rand(i + 13, isMale ? 26 : 24, isMale ? 40 : 36);
    const birthday = new Date(new Date().getFullYear() - age, rand(i + 3, 0, 11), rand(i + 5, 1, 28));
    const eduRoll = rand(i + 17, 0, 100);
    const education = eduRoll < 12 ? 'JUNIOR_COLLEGE' : eduRoll < 70 ? 'BACHELOR' : eduRoll < 92 ? 'MASTER' : 'DOCTOR';
    const maritalRoll = rand(i + 23, 0, 100);
    const maritalStatus = maritalRoll < 78 ? 'SINGLE' : maritalRoll < 96 ? 'DIVORCED' : 'WIDOWED';
    const childrenStatus = maritalStatus === 'SINGLE' ? 'NONE' : rand(i + 29, 0, 100) < 55 ? 'WITH_SELF' : 'NONE';
    const income = rand(i + 31, isMale ? 12 : 8, isMale ? 60 : 40) * 10000;

    const user = await prisma.user.upsert({
      where: { phone },
      create: {
        phone,
        nickname: isMale ? pick(MALE_NAMES, idx) : pick(FEMALE_NAMES, idx),
        passwordHash: pwd,
        roles: { create: { roleId: memberRole.id } },
      },
      update: {},
    });

    const mm = matchmakers[i % matchmakers.length];
    const serialNo = `YQ${String(260810_00000 + i + 1)}`;

    const profile = await prisma.profile.create({
      data: {
        serialNo,
        userId: user.id,
        realName: pick(SURNAMES, i * 3 + 1) + (isMale ? pick(MALE_NAMES, idx) : pick(FEMALE_NAMES, idx)),
        nickname: user.nickname,
        gender: isMale ? 'MALE' : 'FEMALE',
        birthday,
        heightCm: isMale ? rand(i + 37, 168, 186) : rand(i + 41, 155, 172),
        weightKg: isMale ? rand(i + 43, 60, 85) : rand(i + 47, 45, 62),
        education: education as never,
        school: pick(SCHOOLS, i),
        occupation: isMale ? pick(OCCUPATIONS_M, idx) : pick(OCCUPATIONS_F, idx),
        company: `${city.name}某${isMale ? '科技' : '教育'}公司`,
        annualIncome: income,
        maritalStatus: maritalStatus as never,
        childrenStatus: childrenStatus as never,
        houseStatus: (rand(i + 53, 0, 100) < 45 ? 'MORTGAGE' : rand(i + 53, 0, 100) < 70 ? 'FULL_PAID' : 'NONE') as never,
        carStatus: (rand(i + 59, 0, 100) < 50 ? 'FULL_PAID' : 'NONE') as never,
        provinceCode: city.parent,
        cityCode: city.code,
        cityName: city.name,
        lat: city.lat,
        lng: city.lng,
        introduction: isMale ? pick(INTRO_M, idx) : pick(INTRO_F, idx),
        phone,
        wechat: `wx_${phone.slice(-6)}`,
        // 大部分直接给成已通过，留 4 个待审、2 个驳回，方便演示审核流程
        status: (i < 34 ? 'APPROVED' : i < 38 ? 'PENDING' : 'REJECTED') as never,
        rejectReason: i >= 38 ? '照片模糊，请重新上传清晰的正面照' : null,
        source: (i % 5 === 0 ? 'MATCHMAKER' : 'SELF') as never,
        matchmakerId: mm.id,
        lastActiveAt: new Date(Date.now() - rand(i + 61, 0, 20) * 86400_000),
        preference: {
          create: {
            ageMin: isMale ? Math.max(22, age - 8) : Math.max(24, age - 3),
            ageMax: isMale ? age + 2 : age + 10,
            heightMin: isMale ? 155 : 170,
            heightMax: isMale ? 175 : 190,
            educationMin: (rand(i + 67, 0, 100) < 60 ? 'BACHELOR' : 'JUNIOR_COLLEGE') as never,
            incomeMin: isMale ? null : rand(i + 71, 15, 35) * 10000,
            maritalStatus: (maritalStatus === 'SINGLE' ? ['SINGLE'] : ['SINGLE', 'DIVORCED']) as Prisma.InputJsonValue,
            childrenStatus: (childrenStatus === 'NONE' ? ['NONE'] : ['NONE', 'WITH_SELF', 'WITH_OTHER']) as Prisma.InputJsonValue,
            cityCodes: (rand(i + 73, 0, 100) < 70 ? [city.code] : []) as Prisma.InputJsonValue,
            requireHouse: !isMale && rand(i + 79, 0, 100) < 40,
            requireCar: false,
            description: isMale ? pick(PREF_DESC_M, idx) : pick(PREF_DESC_F, idx),
          },
        },
      },
    });

    // 几个 EAV 扩展字段，验证动态表单链路
    const hobbies = ['travel', 'fitness', 'reading', 'music', 'movie', 'cooking', 'pet', 'photography'];
    await prisma.profileFieldValue.createMany({
      data: [
        {
          profileId: profile.id, fieldCode: 'hobby',
          valueJson: [pick(hobbies, i), pick(hobbies, i + 3), pick(hobbies, i + 5)] as Prisma.InputJsonValue,
        },
        {
          profileId: profile.id, fieldCode: 'smoking',
          valueText: isMale ? pick(['never', 'sometimes', 'often'], rand(i + 83, 0, 2)) : 'never',
        },
        {
          profileId: profile.id, fieldCode: 'acceptLongDistance',
          valueNum: rand(i + 89, 0, 100) < 30 ? 1 : 0,
        },
        {
          profileId: profile.id, fieldCode: 'wantChildren',
          valueText: pick(['yes', 'no', 'undecided'], rand(i + 97, 0, 2)),
        },
      ],
      skipDuplicates: true,
    });

    // 审核流水
    await prisma.profileAuditLog.create({
      data: {
        profileId: profile.id,
        fromStatus: 'PENDING',
        toStatus: profile.status,
        reason: profile.status === 'APPROVED' ? '资料完整，审核通过' : profile.status === 'REJECTED' ? profile.rejectReason : '等待审核',
        operatorName: '系统初始化',
      },
    });

    created++;
  }
  console.log(`  3 位红娘（密码 Demo@123456），${created} 份会员档案`);

  // ── 几条牵线，让红娘看板不是空的 ──
  const approved = await prisma.profile.findMany({
    where: { status: 'APPROVED' },
    select: { id: true, gender: true, matchmakerId: true, serialNo: true },
    take: 20,
  });
  const males = approved.filter((p) => p.gender === 'MALE');
  const females = approved.filter((p) => p.gender === 'FEMALE');
  const flows: string[] = ['INITIATED', 'RECOMMENDED', 'BOTH_AGREED', 'CONTACT_EXCHANGED', 'MET', 'SUCCESS', 'FAILED'];

  let introCount = 0;
  for (let i = 0; i < Math.min(males.length, females.length, 7); i++) {
    const a = males[i];
    const b = females[i];
    const pairKey = [a.id, b.id].sort().join(':');
    if (await prisma.introduction.findFirst({ where: { pairKey } })) continue;

    const status = flows[i % flows.length];
    const intro = await prisma.introduction.create({
      data: {
        serialNo: `IN${String(260810_00000 + i + 1)}`,
        matchmakerId: a.matchmakerId!,
        aProfileId: a.id,
        bProfileId: b.id,
        pairKey,
        status: status as never,
        aAgreed: ['BOTH_AGREED', 'CONTACT_EXCHANGED', 'MET', 'SUCCESS'].includes(status),
        bAgreed: ['BOTH_AGREED', 'CONTACT_EXCHANGED', 'MET', 'SUCCESS'].includes(status),
        remark: '两位都在同一城市，学历和年龄都比较搭，建议先加微信聊聊。',
        matchScore: rand(i + 101, 62, 93),
        resultNote: status === 'SUCCESS' ? '双方已确定关系，感谢红娘' : status === 'FAILED' ? '见面后觉得性格不太合适' : null,
      },
    });
    await prisma.introductionEvent.create({
      data: {
        introductionId: intro.id,
        fromStatus: null,
        toStatus: 'INITIATED',
        note: '红娘发起牵线',
        operatorName: '系统初始化',
      },
    });
    introCount++;
  }
  console.log(`  ${introCount} 条牵线记录（覆盖各个状态）`);
}

async function main() {
  console.log('\n═══ 缘桥 数据初始化 ═══\n');
  await seedPermissionsAndRoles();
  await seedAdmin();
  await seedRegions();
  await seedFields();
  await seedPackages();
  if (SEED_DEMO) await seedDemo();
  else console.log('▸ 跳过演示数据（SEED_DEMO=false）');

  console.log('\n═══ 完成 ═══');
  console.log('后台登录：admin / Admin@123456');
  if (SEED_DEMO) {
    console.log('红娘登录：13900000001 / Demo@123456');
    console.log('会员登录：任意 1370000xxxx，短信验证码 8888（SMS_PROVIDER=mock）');
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error('种子数据执行失败：', e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
