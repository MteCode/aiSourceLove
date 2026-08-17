/**
 * 前后端共享的 API 契约。
 * 后端 DTO 继承/实现这些接口，前端直接 import，改一处两边都会红。
 */

import type {
  AuditStatus,
  BenefitCode,
  CarStatus,
  ChildrenStatus,
  CommissionStatus,
  Education,
  FieldType,
  Gender,
  HouseStatus,
  IntroductionStatus,
  MaritalStatus,
  OrderStatus,
  PayChannel,
  ProfileSource,
  ProfileStatus,
  ResetCycle,
  VisibilityLevel,
} from './enums';
import type { MaskedValue } from './privacy';
import type { MatchWeightKey } from './constants';

// ============ 通用外壳 ============

/** 所有接口统一返回这个信封，code=0 表示成功 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  /** 便于排查线上问题，每个请求一个 id */
  traceId?: string;
}

export interface PageQuery {
  page?: number;
  pageSize?: number;
  /** 排序字段，如 "createdAt" */
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============ 认证 ============

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: CurrentUser;
}

export interface CurrentUser {
  id: string;
  phone: string;
  nickname: string | null;
  avatar: string | null;
  roles: string[];
  /** 权限点集合，前端按钮级鉴权用 */
  permissions: string[];
  /** 有档案才有值 */
  profileId: string | null;
  profileStatus: ProfileStatus | null;
  isVip: boolean;
  vipExpireAt: string | null;
  /** 该用户是红娘时有值 */
  matchmakerId: string | null;
  /**
   * 能否申请成为红娘。
   * 红娘分享来的人是客户，不给这个入口；管理员分享来的才给。
   */
  canApplyMatchmaker: boolean;
}

// ============ 模块1：动态字段字典 ============

/** 字段选项 */
export interface FieldOption {
  value: string;
  label: string;
  /** 用于打分的数值映射，如收入档位 */
  score?: number;
}

/** 字段定义 —— 动态表单的单元。运营在后台加字段，前端自动多出一个输入框。 */
export interface FieldDefDto {
  id: string;
  /** 唯一编码，落库到 EAV 表或映射到固定列 */
  code: string;
  label: string;
  type: FieldType;
  groupId: string;
  groupName: string;
  /** SELECT / MULTI_SELECT 才有 */
  options: FieldOption[] | null;
  placeholder: string | null;
  /** 字段说明，表单下方灰字 */
  helpText: string | null;
  required: boolean;
  /** 该字段的可见等级（模块4 靠它做投影） */
  visibility: VisibilityLevel;
  /**
   * 是否映射到 profile 固定列。
   * true = 高频过滤字段（性别/年龄/城市…），走固定列，能建索引；
   * false = 扩展字段，走 EAV，加字段不用改表。
   */
  isCore: boolean;
  /** 是否参与择偶条件（生成"我的要求"表单） */
  isPreference: boolean;
  /** 参与 L2 打分时对应的权重键 */
  weightKey: MatchWeightKey | null;
  /** 校验规则 */
  minValue: number | null;
  maxValue: number | null;
  maxLength: number | null;
  regex: string | null;
  sort: number;
  enabled: boolean;
}

export interface FieldGroupDto {
  id: string;
  code: string;
  name: string;
  sort: number;
  fields: FieldDefDto[];
}

/** 完整表单 schema，前端拿到直接渲染 */
export interface FormSchemaDto {
  groups: FieldGroupDto[];
  /** schema 版本号，前端可据此判断缓存是否过期 */
  version: string;
}

// ============ 档案 ============

export interface PhotoDto {
  id: string;
  /** 已按观看者权限处理过：没权限时这里是打码图地址 */
  url: string;
  /** 是否是打码版本 */
  masked: boolean;
  isPrimary: boolean;
  auditStatus: AuditStatus;
  sort: number;
}

/** 择偶要求 */
export interface PreferenceDto {
  ageMin: number | null;
  ageMax: number | null;
  heightMin: number | null;
  heightMax: number | null;
  educationMin: Education | null;
  incomeMin: number | null;
  /** 接受的婚史，空数组=不限 */
  maritalStatus: MaritalStatus[];
  /** 接受的子女情况，空数组=不限 */
  childrenStatus: ChildrenStatus[];
  /** 期望城市 adcode 列表，空=不限 */
  cityCodes: string[];
  /** 是否要求有房 */
  requireHouse: boolean;
  requireCar: boolean;
  /** 自由描述，喂给 AI 层做语义匹配 */
  description: string | null;
}

/**
 * 档案对外视图。
 * 注意 T | MaskedValue：没权限的字段会被替换成 MaskedValue，
 * 前端用 isMaskedValue() 判断后渲染锁图标。
 */
export interface ProfileDto {
  id: string;
  /** 展示编号，如 YQ100238，比 uuid 好念，红娘打电话报这个 */
  serialNo: string;
  /** 昵称或脱敏后的姓名 */
  displayName: string;
  realName: string | MaskedValue | null;
  gender: Gender;
  age: number;
  birthday: string | MaskedValue | null;
  heightCm: number | null;
  weightKg: number | null;
  education: Education | null;
  school: string | MaskedValue | null;
  occupation: string | null;
  company: string | MaskedValue | null;
  /** 年收入，单位：元 */
  annualIncome: number | MaskedValue | null;
  maritalStatus: MaritalStatus;
  childrenStatus: ChildrenStatus;
  houseStatus: HouseStatus | null;
  carStatus: CarStatus | null;
  provinceCode: string | null;
  cityCode: string | null;
  districtCode: string | null;
  cityName: string | null;
  hometownCityName: string | null;
  /** 自我介绍 */
  introduction: string | null;
  /** 联系方式 —— 默认锁死，VIP 解锁或牵线成功后才给 */
  phone: string | MaskedValue | null;
  wechat: string | MaskedValue | null;
  /** 无权限时为空数组，配合 photosLocked 展示引导文案 */
  photos: PhotoDto[];
  /** true = 有照片但你看不到，需联系红娘。区别于「这个人本来就没传照片」 */
  photosLocked: boolean;
  /** 'YEAR' 时只有出生年可信，展示层不要显示完整日期 */
  birthdayPrecision: 'DAY' | 'YEAR';
  preference: PreferenceDto | null;
  /** 扩展字段（EAV），key 是 fieldDef.code */
  extras: Record<string, unknown>;
  status: ProfileStatus;
  source: ProfileSource;
  /** 归属红娘 */
  matchmakerId: string | null;
  matchmakerName: string | null;
  isTop: boolean;
  lastActiveAt: string | null;
  createdAt: string;
  /** 当前观看者相对这份档案的等级，前端据此决定引导什么 */
  viewerLevel: VisibilityLevel;
}

/** 列表页用的精简版 */
export interface ProfileBriefDto {
  id: string;
  serialNo: string;
  displayName: string;
  gender: Gender;
  age: number;
  /** 出生年。用来算生肖——照片不展示时它承担头像的角色 */
  birthYear: number;
  heightCm: number | null;
  education: Education | null;
  cityName: string | null;
  occupation: string | null;
  avatarUrl: string | null;
  /** true = 有头像但你看不到，需联系红娘 */
  avatarMasked: boolean;
  isTop: boolean;
  status: ProfileStatus;
}

/** 审核操作 */
export interface AuditActionDto {
  targetStatus: ProfileStatus;
  /** 驳回必填 */
  reason?: string;
  /** 驳回时指出是哪些字段有问题，前端高亮 */
  rejectedFields?: string[];
}

export interface AuditLogDto {
  id: string;
  fromStatus: ProfileStatus | null;
  toStatus: ProfileStatus;
  reason: string | null;
  operatorId: string;
  operatorName: string;
  createdAt: string;
}

// ============ 模块2：匹配 ============

/** 单项打分明细 —— 一定要给出来，否则红娘不信任推荐结果 */
export interface MatchScoreDetail {
  key: MatchWeightKey;
  label: string;
  /** 0~1 的原始得分 */
  raw: number;
  weight: number;
  /** raw * weight */
  weighted: number;
  /** 人话解释，如"年龄差 3 岁" */
  note: string;
}

export interface MatchResultDto {
  profile: ProfileBriefDto;
  /** 0~100 综合分 */
  score: number;
  details: MatchScoreDetail[];
  /** 我满足对方要求的程度 0~1 */
  aSatisfiesB: number;
  /** 对方满足我要求的程度 0~1 */
  bSatisfiesA: number;
  /** AI 生成的推荐理由（L3 层开启时才有） */
  aiReason: string | null;
  /** 命中的加分点，前端做标签 */
  highlights: string[];
  /** 需要注意的点，如"对方要求有房" */
  concerns: string[];
}

export interface MatchQueryDto extends PageQuery {
  /** 给谁匹配。红娘可传名下任意会员；普通用户只能传自己 */
  profileId: string;
  /** 是否启用 AI 层（消耗权益） */
  enableAi?: boolean;
  /** 临时覆盖权重，后台调参用 */
  weights?: Partial<Record<MatchWeightKey, number>>;
  /** 只看某城市 */
  cityCode?: string;
  minScore?: number;
}

// ============ 模块3：红娘 ============

/**
 * 给客户看的红娘名片。
 *
 * 刻意不复用 MatchmakerDto：那个带 commissionRate（分润比例）和业绩数字，
 * 是内部经营数据。客户只需要知道"我的红娘是谁、怎么联系她"。
 */
export interface MyMatchmakerDto {
  id: string;
  name: string;
  avatar: string | null;
  cityName: string | null;
  bio: string | null;
  /** 客户要能直接打过去，这是这个接口存在的意义 */
  phone: string;
}

export interface MatchmakerDto {
  id: string;
  userId: string;
  name: string;
  phone: string;
  avatar: string | null;
  /** 服务城市 */
  cityName: string | null;
  bio: string | null;
  /** 分润比例，0~1 */
  commissionRate: number;
  status: string;
  /** 名下会员数 */
  memberCount: number;
  /** 牵线总数 */
  introCount: number;
  /** 成功数 */
  successCount: number;
  /** 累计分润（分） */
  totalCommission: number;
  /** 可提现余额（分） */
  availableBalance: number;
  createdAt: string;
}

export interface IntroductionDto {
  id: string;
  serialNo: string;
  matchmakerId: string;
  matchmakerName: string;
  sideA: ProfileBriefDto;
  sideB: ProfileBriefDto;
  status: IntroductionStatus;
  aAgreed: boolean;
  bAgreed: boolean;
  /** 红娘写给双方的推荐语 */
  remark: string | null;
  /** 匹配分快照，避免事后资料变了对不上 */
  matchScore: number | null;
  events: IntroductionEventDto[];
  /** 结果反馈 */
  resultNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntroductionEventDto {
  id: string;
  fromStatus: IntroductionStatus | null;
  toStatus: IntroductionStatus;
  note: string | null;
  operatorId: string;
  operatorName: string;
  createdAt: string;
}

export interface CommissionDto {
  id: string;
  matchmakerId: string;
  source: string;
  /** 分 */
  amount: number;
  status: CommissionStatus;
  /** 关联订单/牵线单 */
  refId: string | null;
  refNo: string | null;
  remark: string | null;
  /** 冷静期结束、可提现的时间 */
  settleAt: string | null;
  createdAt: string;
}

export interface MatchmakerStatsDto {
  memberCount: number;
  /** 本月新增会员 */
  memberCountThisMonth: number;
  introCount: number;
  introCountThisMonth: number;
  successCount: number;
  /** 成功率 */
  successRate: number;
  totalCommission: number;
  pendingCommission: number;
  availableBalance: number;
  withdrawnAmount: number;
  /** 按状态分布，画漏斗用 */
  funnel: { status: IntroductionStatus; label: string; count: number }[];
}

// ============ 模块5：VIP 与订单 ============

export interface BenefitSpec {
  code: BenefitCode;
  /** 数量：次数或天数 */
  quota: number;
  /** 不传则用 BENEFIT_META 里该权益的默认周期 */
  cycle?: ResetCycle;
}

export interface VipPackageDto {
  id: string;
  name: string;
  subtitle: string | null;
  /** 分 */
  price: number;
  /** 划线原价，分 */
  originalPrice: number | null;
  durationDays: number;
  benefits: BenefitSpec[];
  /** 推荐标记 */
  isRecommended: boolean;
  sort: number;
  enabled: boolean;
}

export interface OrderDto {
  id: string;
  orderNo: string;
  userId: string;
  userPhone: string;
  packageId: string;
  packageName: string;
  /** 分 */
  amount: number;
  payChannel: PayChannel | null;
  status: OrderStatus;
  paidAt: string | null;
  /** 未支付时的关闭时间 */
  expireAt: string | null;
  refundAmount: number;
  refundReason: string | null;
  /** 归属红娘（用于分润） */
  matchmakerId: string | null;
  createdAt: string;
}

/** 下单返回，前端拿 payParams 拉起支付 */
export interface CreateOrderResult {
  order: OrderDto;
  /** 微信支付的 JSAPI 参数 / mock 通道的模拟支付地址 */
  payParams: Record<string, string>;
}

export interface UserBenefitDto {
  code: BenefitCode;
  label: string;
  unit: string;
  /** 总额度 */
  total: number;
  /** 已用 */
  used: number;
  /** 剩余 */
  remaining: number;
  cycle: ResetCycle;
  /** 本周期重置时间 */
  resetAt: string | null;
  expireAt: string | null;
}

// ============ 模块6：后台看板 ============

export interface DashboardDto {
  /** 会员 */
  totalMembers: number;
  newMembersToday: number;
  pendingAudit: number;
  pendingPhotoAudit: number;
  /** 男女比 */
  genderRatio: { male: number; female: number };
  /** 红娘 */
  totalMatchmakers: number;
  activeIntroductions: number;
  successIntroductions: number;
  /** 营收，分 */
  revenueToday: number;
  revenueThisMonth: number;
  revenueTotal: number;
  vipCount: number;
  /** 近 30 天趋势 */
  trend: { date: string; newMembers: number; revenue: number; introductions: number }[];
  /** 城市分布 Top10 */
  cityDistribution: { cityName: string; count: number }[];
}
