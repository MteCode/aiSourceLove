import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, Profile, ProfilePhoto } from '@prisma/client';
import {
  BenefitCode,
  MaskedValue,
  PhotoDto,
  ProfileBriefDto,
  ProfileDto,
  RoleCode,
  UnlockSource,
  VisibilityLevel,
  ViewerContext,
  calcAge,
  canSee,
  lockedValue,
  maskAccount,
  maskName,
  maskPhone,
  toDateStr,
} from '@yuanqiao/shared';
import { BizException } from '@/common/filters/all-exceptions.filter';
import type { AuthUser } from '@/common/types/auth-user';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { StorageService } from '@/infra/storage/storage.service';
import { FieldService } from '@/modules/field/field.service';
import { BenefitService } from '@/modules/vip/benefit.service';

/** 看原图（不打码）需要的等级。VIP 能看清晰照片是核心卖点之一。 */
/**
 * 照片可见门槛。
 *
 * 定在 MATCHMAKER 而不是 VIP：业务规则是照片和联系方式都不对外展示，
 * 想看得联系红娘。这样连 VIP 和已解锁的人也看不到图——
 * 相亲对象的照片外流一次就是不可挽回的事故，宁可保守。
 */
const PHOTO_ORIGINAL_LEVEL = VisibilityLevel.MATCHMAKER;

/**
 * 字段可见等级的兜底表。
 * 正常情况下等级来自 FieldDef.visibility（运营可在后台调），
 * 这里是字典里没配这个字段时的默认值——宁可保守，不可泄露。
 */
const DEFAULT_VISIBILITY: Record<string, VisibilityLevel> = {
  nickname: VisibilityLevel.PUBLIC,
  gender: VisibilityLevel.PUBLIC,
  age: VisibilityLevel.PUBLIC,
  heightCm: VisibilityLevel.PUBLIC,
  cityName: VisibilityLevel.PUBLIC,
  education: VisibilityLevel.PUBLIC,
  occupation: VisibilityLevel.MEMBER,
  introduction: VisibilityLevel.MEMBER,
  weightKg: VisibilityLevel.MEMBER,
  maritalStatus: VisibilityLevel.MEMBER,
  childrenStatus: VisibilityLevel.MEMBER,
  hometownCityName: VisibilityLevel.MEMBER,
  houseStatus: VisibilityLevel.VIP,
  carStatus: VisibilityLevel.VIP,
  school: VisibilityLevel.VIP,
  company: VisibilityLevel.VIP,
  annualIncome: VisibilityLevel.VIP,
  birthday: VisibilityLevel.VIP,
  // 命门：真实姓名和联系方式
  realName: VisibilityLevel.UNLOCKED,
  phone: VisibilityLevel.UNLOCKED,
  wechat: VisibilityLevel.UNLOCKED,
};

type ProfileWithRelations = Profile & {
  photos?: ProfilePhoto[];
  preference?: Prisma.PreferenceGetPayload<object> | null;
  fieldValues?: Prisma.ProfileFieldValueGetPayload<object>[];
  matchmaker?: { id: string; name: string } | null;
};

/**
 * 隐私分级服务（模块4）。
 *
 * 全站**唯一**允许把 Profile 变成对外 DTO 的地方。
 * 任何绕过 project() 直接把 Prisma 实体 return 出去的代码都是数据泄露，
 * code review 必查这一条。
 */
@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly field: FieldService,
    private readonly benefit: BenefitService,
  ) {}

  // ───────── 观看者上下文 ─────────

  async resolveViewer(profile: Profile, user: AuthUser | null): Promise<ViewerContext> {
    if (!user) {
      return {
        userId: null,
        isSelf: false,
        isAdmin: false,
        isMatchmakerOf: false,
        isVip: false,
        isUnlocked: false,
      };
    }

    const isAdmin =
      user.roles.includes(RoleCode.SUPER_ADMIN) ||
      user.roles.includes(RoleCode.ADMIN) ||
      user.roles.includes(RoleCode.AUDITOR);

    const isSelf = !!profile.userId && profile.userId === user.userId;

    // 红娘只对**自己名下**的会员有特权，不是所有红娘都能看所有人
    const isMatchmakerOf = !!user.matchmakerId && profile.matchmakerId === user.matchmakerId;

    const isUnlocked = isSelf
      ? true
      : await this.isUnlocked(user.userId, profile.id);

    return {
      userId: user.userId,
      isSelf,
      isAdmin,
      isMatchmakerOf,
      isVip: user.isVip,
      isUnlocked,
    };
  }

  async isUnlocked(viewerUserId: string, targetProfileId: string): Promise<boolean> {
    const row = await this.prisma.contactUnlock.findUnique({
      where: { viewerUserId_targetProfileId: { viewerUserId, targetProfileId } },
      select: { expiresAt: true },
    });
    if (!row) return false;
    return !row.expiresAt || row.expiresAt > new Date();
  }

  /** 由 ViewerContext 算出等级。等价于 shared 里的 resolveViewerLevel，这里重导出保持单一入口。 */
  levelOf(ctx: ViewerContext): VisibilityLevel {
    if (ctx.isAdmin) return VisibilityLevel.ADMIN;
    if (ctx.isSelf) return VisibilityLevel.ADMIN;
    if (ctx.isMatchmakerOf) return VisibilityLevel.MATCHMAKER;
    if (ctx.isUnlocked) return VisibilityLevel.UNLOCKED;
    if (ctx.isVip) return VisibilityLevel.VIP;
    if (ctx.userId) return VisibilityLevel.MEMBER;
    return VisibilityLevel.PUBLIC;
  }

  // ───────── 投影（脱敏）─────────

  /** 取字段的可见等级：优先用字典里配的，没配用兜底表，再没有就当 VIP 级（保守） */
  private async visibilityMap(): Promise<Map<string, VisibilityLevel>> {
    const defs = await this.field.getEnabledFields();
    const map = new Map<string, VisibilityLevel>(Object.entries(DEFAULT_VISIBILITY));
    for (const d of defs) map.set(d.code, d.visibility);
    return map;
  }

  private levelFor(map: Map<string, VisibilityLevel>, code: string): VisibilityLevel {
    return map.get(code) ?? VisibilityLevel.VIP;
  }

  /**
   * 把 Profile 实体投影成对外 DTO。
   *
   * 规则：看得见就给真值，看不见就换成 MaskedValue（带引导文案和脱敏预览）。
   * 给预览而不是直接抹掉，是为了让用户看到"138****8888"从而有付费冲动——
   * 完全不显示的话用户不知道有什么可解锁的。
   */
  async project(
    profile: ProfileWithRelations,
    viewer: ViewerContext,
  ): Promise<ProfileDto> {
    const level = this.levelOf(viewer);
    const vis = await this.visibilityMap();

    /** 看得见→真值；看不见→MaskedValue */
    const gate = <T>(code: string, value: T, preview?: string): T | MaskedValue | null => {
      if (value === null || value === undefined) return null;
      const need = this.levelFor(vis, code);
      if (canSee(level, need)) return value;
      return lockedValue(need, preview);
    };

    const extras: Record<string, unknown> = {};
    for (const fv of profile.fieldValues ?? []) {
      const need = this.levelFor(vis, fv.fieldCode);
      const raw = fv.valueJson ?? fv.valueText ?? fv.valueNum ?? fv.valueDate ?? null;
      extras[fv.fieldCode] = canSee(level, need) ? raw : lockedValue(need);
    }

    const age = calcAge(profile.birthday);
    const showOriginalPhoto = level >= PHOTO_ORIGINAL_LEVEL;

    return {
      id: profile.id,
      serialNo: profile.serialNo,
      // 展示名：有昵称用昵称，否则用脱敏后的真名（张*），都没有就用编号
      displayName:
        profile.nickname || (profile.realName ? maskName(profile.realName) : profile.serialNo),
      realName: gate('realName', profile.realName, maskName(profile.realName)),
      gender: profile.gender as ProfileDto['gender'],
      age,
      birthday: gate('birthday', toDateStr(profile.birthday)) as string | MaskedValue | null,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      education: profile.education as ProfileDto['education'],
      school: gate('school', profile.school),
      occupation: profile.occupation,
      company: gate('company', profile.company),
      annualIncome: gate('annualIncome', profile.annualIncome),
      maritalStatus: profile.maritalStatus as ProfileDto['maritalStatus'],
      childrenStatus: profile.childrenStatus as ProfileDto['childrenStatus'],
      houseStatus: profile.houseStatus as ProfileDto['houseStatus'],
      carStatus: profile.carStatus as ProfileDto['carStatus'],
      provinceCode: profile.provinceCode,
      cityCode: profile.cityCode,
      districtCode: profile.districtCode,
      cityName: profile.cityName,
      hometownCityName: profile.hometownCityName,
      introduction: profile.introduction,
      phone: gate('phone', profile.phone, maskPhone(profile.phone)),
      wechat: gate('wechat', profile.wechat, maskAccount(profile.wechat)),
      photos: showOriginalPhoto ? this.projectPhotos(profile.photos ?? [], true, viewer) : [],
      // 有照片却看不到，和本来就没照片是两回事，前端要给的文案不一样
      photosLocked: !showOriginalPhoto && (profile.photos?.length ?? 0) > 0,
      birthdayPrecision: (profile.birthdayPrecision as 'DAY' | 'YEAR') ?? 'DAY',
      preference: profile.preference
        ? {
            ageMin: profile.preference.ageMin,
            ageMax: profile.preference.ageMax,
            heightMin: profile.preference.heightMin,
            heightMax: profile.preference.heightMax,
            educationMin: profile.preference.educationMin as never,
            incomeMin: profile.preference.incomeMin,
            maritalStatus: (profile.preference.maritalStatus as never[]) ?? [],
            childrenStatus: (profile.preference.childrenStatus as never[]) ?? [],
            cityCodes: (profile.preference.cityCodes as string[]) ?? [],
            requireHouse: profile.preference.requireHouse,
            requireCar: profile.preference.requireCar,
            description: profile.preference.description,
          }
        : null,
      extras,
      status: profile.status as ProfileDto['status'],
      source: profile.source as ProfileDto['source'],
      matchmakerId: profile.matchmakerId,
      matchmakerName: profile.matchmaker?.name ?? null,
      isTop: profile.isTop && (!profile.topExpireAt || profile.topExpireAt > new Date()),
      lastActiveAt: profile.lastActiveAt?.toISOString() ?? null,
      createdAt: profile.createdAt.toISOString(),
      viewerLevel: level,
    };
  }

  private projectPhotos(
    photos: ProfilePhoto[],
    showOriginal: boolean,
    viewer: ViewerContext,
  ): PhotoDto[] {
    return photos
      // 未过审的照片只有本人、归属红娘、管理员看得到
      .filter((p) => p.auditStatus === 'APPROVED' || viewer.isSelf || viewer.isMatchmakerOf || viewer.isAdmin)
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sort - b.sort)
      .map((p) => {
        return {
          id: p.id,
          // 没权限就不给任何图。原来这里是"没有打码版就回退给原图"，
          // 那是把"缺数据"当成了"可放行"，方向正好反了。
          url: showOriginal ? this.storage.toAbsoluteUrl(p.url) ?? '' : '',
          masked: !showOriginal,
          isPrimary: p.isPrimary,
          auditStatus: p.auditStatus as PhotoDto['auditStatus'],
          sort: p.sort,
        };
      });
  }

  /** 列表页的精简投影。列表一律用打码头像，看清楚请点进详情——这是转化漏斗设计。 */
  projectBrief(
    profile: Profile & { photos?: ProfilePhoto[] },
    viewerLevel: VisibilityLevel,
  ): ProfileBriefDto {
    const primary =
      profile.photos?.find((p) => p.isPrimary && p.auditStatus === 'APPROVED') ??
      profile.photos?.find((p) => p.auditStatus === 'APPROVED');
    const showOriginal = viewerLevel >= PHOTO_ORIGINAL_LEVEL;

    return {
      id: profile.id,
      serialNo: profile.serialNo,
      displayName:
        profile.nickname || (profile.realName ? maskName(profile.realName) : profile.serialNo),
      gender: profile.gender as ProfileBriefDto['gender'],
      age: calcAge(profile.birthday),
      heightCm: profile.heightCm,
      education: profile.education as ProfileBriefDto['education'],
      cityName: profile.cityName,
      occupation: profile.occupation,
      // 没权限一律不给图；有照片但看不到时置 avatarMasked，
      // 前端据此显示"照片需联系红娘"，而不是显示成这个人没传照片
      avatarUrl: primary && showOriginal ? this.storage.toAbsoluteUrl(primary.url) : null,
      avatarMasked: !!primary && !showOriginal,
      isTop: profile.isTop && (!profile.topExpireAt || profile.topExpireAt > new Date()),
      status: profile.status as ProfileBriefDto['status'],
    };
  }

  // ───────── 解锁联系方式 ─────────

  /**
   * 花权益解锁某人的联系方式。
   *
   * 幂等：同一个人只会扣一次次数，重复调用直接返回已解锁。
   * 这个接口是要花用户钱的，必须经得起重复点击和网络重试。
   */
  async unlockContact(
    viewerUserId: string,
    targetProfileId: string,
  ): Promise<{ unlocked: boolean; alreadyUnlocked: boolean; remaining: number }> {
    const target = await this.prisma.profile.findFirst({
      where: { id: targetProfileId, deletedAt: null },
      select: { id: true, userId: true, status: true },
    });
    if (!target) throw new NotFoundException('该会员不存在');
    if (target.userId === viewerUserId) {
      throw new BizException('不用解锁自己', 40020);
    }
    if (target.status !== 'APPROVED') {
      throw new BizException('该会员资料未通过审核或已下架，暂不可解锁', 40021);
    }

    const already = await this.prisma.contactUnlock.findUnique({
      where: { viewerUserId_targetProfileId: { viewerUserId, targetProfileId } },
    });
    if (already) {
      const { remaining } = await this.benefit.getRemaining(viewerUserId, BenefitCode.UNLOCK_CONTACT);
      return { unlocked: true, alreadyUnlocked: true, remaining };
    }

    return this.prisma.$transaction(async (tx) => {
      const r = await this.benefit.consume({
        userId: viewerUserId,
        code: BenefitCode.UNLOCK_CONTACT,
        bizType: 'UNLOCK_CONTACT',
        // 幂等键与"谁解锁谁"一一对应
        bizKey: `unlock:${viewerUserId}:${targetProfileId}`,
        remark: `解锁 ${targetProfileId} 的联系方式`,
        tx,
      });

      await tx.contactUnlock.upsert({
        where: { viewerUserId_targetProfileId: { viewerUserId, targetProfileId } },
        create: { viewerUserId, targetProfileId, source: UnlockSource.BENEFIT },
        update: {},
      });

      return { unlocked: true, alreadyUnlocked: r.alreadyConsumed, remaining: r.remaining };
    });
  }

  /** 牵线成功后双方自动互相解锁，不扣次数——这是红娘服务的价值体现 */
  async unlockByIntroduction(
    aUserId: string | null,
    bUserId: string | null,
    aProfileId: string,
    bProfileId: string,
    introductionId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const pairs: { viewerUserId: string; targetProfileId: string }[] = [];
    if (aUserId) pairs.push({ viewerUserId: aUserId, targetProfileId: bProfileId });
    if (bUserId) pairs.push({ viewerUserId: bUserId, targetProfileId: aProfileId });

    for (const p of pairs) {
      await tx.contactUnlock.upsert({
        where: {
          viewerUserId_targetProfileId: {
            viewerUserId: p.viewerUserId,
            targetProfileId: p.targetProfileId,
          },
        },
        create: { ...p, source: UnlockSource.INTRODUCTION, introductionId },
        update: { source: UnlockSource.INTRODUCTION, introductionId },
      });
    }
  }

  /** 后台手工赠送解锁 */
  async unlockByAdmin(viewerUserId: string, targetProfileId: string): Promise<void> {
    await this.prisma.contactUnlock.upsert({
      where: { viewerUserId_targetProfileId: { viewerUserId, targetProfileId } },
      create: { viewerUserId, targetProfileId, source: UnlockSource.ADMIN },
      update: { source: UnlockSource.ADMIN },
    });
  }

  // ───────── 浏览记录与配额 ─────────

  /**
   * 记录一次浏览，并消耗"每日查看资料"权益。
   *
   * 当天重复看同一个人不重复扣次数——不然用户来回翻两下额度就没了，
   * 体验差且会被投诉。靠 (viewer, target, dayKey) 唯一键实现。
   */
  async recordView(
    viewerUserId: string,
    targetProfileId: string,
    opts: { consumeQuota: boolean },
  ): Promise<{ counted: boolean; remaining: number | null }> {
    const dayKey = toDateStr(new Date());

    const existing = await this.prisma.profileView.findUnique({
      where: {
        viewerUserId_targetProfileId_dayKey: { viewerUserId, targetProfileId, dayKey },
      },
      select: { id: true },
    });

    if (existing) {
      // 今天已经看过，不再扣次数
      return { counted: false, remaining: null };
    }

    if (opts.consumeQuota) {
      const r = await this.benefit.consume({
        userId: viewerUserId,
        code: BenefitCode.VIEW_PROFILE,
        bizType: 'VIEW_PROFILE',
        bizKey: `view:${viewerUserId}:${targetProfileId}:${dayKey}`,
        remark: '查看资料',
      });
      await this.writeView(viewerUserId, targetProfileId, dayKey);
      return { counted: true, remaining: r.remaining };
    }

    await this.writeView(viewerUserId, targetProfileId, dayKey);
    return { counted: true, remaining: null };
  }

  private async writeView(viewerUserId: string, targetProfileId: string, dayKey: string) {
    await this.prisma.profileView
      .create({ data: { viewerUserId, targetProfileId, dayKey } })
      .catch(() => undefined); // 并发下唯一键冲突，忽略即可
    await this.prisma.profile
      .update({ where: { id: targetProfileId }, data: { viewCount: { increment: 1 } } })
      .catch(() => undefined);
  }

  /** 谁看过我 */
  async listVisitors(profileId: string, take = 50) {
    return this.prisma.profileView.findMany({
      where: { targetProfileId: profileId },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        viewer: {
          select: { id: true, nickname: true, avatar: true, profile: { select: { id: true } } },
        },
      },
    });
  }
}
