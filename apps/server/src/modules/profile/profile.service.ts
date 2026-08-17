import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FieldType as PrismaFieldType, Prisma, Profile, ProfileStatus as PrismaProfileStatus } from '@prisma/client';
import {
  AuditLogDto,
  FieldType,
  PROFILE_STATUS_TRANSITIONS,
  PageResult,
  ProfileBriefDto,
  ProfileDto,
  ProfileSource,
  ProfileStatus,
  RoleCode,
  VisibilityLevel,
  ageRangeToBirthdayRange,
  assertTransition,
} from '@yuanqiao/shared';
import { BizException } from '@/common/filters/all-exceptions.filter';
import { buildPageResult } from '@/common/dto/pagination.dto';
import type { AuthUser } from '@/common/types/auth-user';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { UserContextService } from '@/modules/auth/user-context.service';
import { StorageService } from '@/infra/storage/storage.service';
import { FieldService } from '@/modules/field/field.service';
import { PrivacyService } from '@/modules/privacy/privacy.service';
import {
  AuditPhotoDto,
  AuditProfileDto,
  MatchmakerCreateProfileDto,
  PreferenceInputDto,
  QueryProfileDto,
  UpsertProfileDto,
  AdminUpdateProfileDto,
} from './dto/profile.dto';

/**
 * 改了这些字段就要重新送审。
 * 改昵称、改身高不用重审（无关紧要），改真名、婚史、学历必须重审（会骗人的地方）。
 */
const REAUDIT_FIELDS = new Set([
  'realName', 'birthday', 'gender', 'education', 'school',
  'maritalStatus', 'childrenStatus', 'annualIncome', 'introduction', 'phone',
]);

const PROFILE_INCLUDE = {
  photos: true,
  preference: true,
  fieldValues: true,
  matchmaker: { select: { id: true, name: true } },
} satisfies Prisma.ProfileInclude;

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly field: FieldService,
    private readonly privacy: PrivacyService,
    private readonly storage: StorageService,
    private readonly userContext: UserContextService,
  ) {}

  // ═══════ 录入路径 1：用户自填 ═══════

  /**
   * 本人创建或更新档案。
   *
   * viewer 必须一路传下去：toDto 靠它判 isSelf，传 null 会走匿名投影，
   * 而新建的档案是 DRAFT，匿名看不见——于是"存成功了却返回 404 该会员资料不可见"。
   * 用户看到的现象是资料保存不上，实际库里已经写进去了，很难查。
   */
  async upsertSelf(userId: string, dto: UpsertProfileDto, viewer: AuthUser): Promise<ProfileDto> {
    const existing = await this.prisma.profile.findFirst({
      where: { userId, deletedAt: null },
      include: PROFILE_INCLUDE,
    });

    if (!existing) {
      // 注册时挂在用户上的邀请红娘，建档时转写过来
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { inviteMatchmakerId: true },
      });
      const created = await this.create(dto, {
        userId,
        source: ProfileSource.SELF,
        matchmakerId: user?.inviteMatchmakerId ?? null,
      });
      // 用户上下文缓存里 profileId 还是 null，不清的话接下来 60 秒内
      // 所有依赖 profileId 的逻辑都以为这人没档案——广场的异性过滤就是这么失效的
      await this.userContext.invalidate(userId);
      return this.toDto(created.id, { ...viewer, profileId: created.id });
    }

    await this.update(existing, dto, { operatorId: userId, operatorName: '本人' });
    return this.toDto(existing.id, viewer);
  }

  /**
   * 后台改档案（管理员 / 该档案的归属红娘）。
   *
   * 存在的意义主要是姓名和联系方式这类**只有红娘该知道、会员自己不填**的信息：
   * 姓名字段已从会员端表单撤掉，红娘线下核实后在后台补录。
   *
   * 复用 update() 而不是另写一套：审核状态流转、EAV 落库、
   * 改关键字段要重新送审这些规则都在里面，绕开就会走偏。
   */
  async updateByAdmin(
    profileId: string,
    dto: AdminUpdateProfileDto,
    viewer: AuthUser,
  ): Promise<ProfileDto> {
    const existing = await this.prisma.profile.findFirst({
      where: { id: profileId, deletedAt: null },
      include: PROFILE_INCLUDE,
    });
    if (!existing) throw new NotFoundException('档案不存在');

    await this.update(
      existing,
      dto,
      { operatorId: viewer.userId, operatorName: viewer.nickname ?? '后台' },
      // 后台改动不重新送审：改的人本来就是审核方。
      // 不加这条，红娘纠正一个错别字就会把已通过的档案打回待审队列。
      { skipReaudit: true },
    );
    // viewer 必须传管理员本人：传 null 走匿名投影，
    // 一旦档案不是已通过状态就会被判成"不可见"，改成功了却报 404
    return this.toDto(existing.id, viewer);
  }

  /**
   * 只更新择偶要求。
   *
   * 不能复用 upsertSelf：那走的是「整份档案提交」的 DTO，性别、生日、常住城市
   * 都是必填。用户只想改一下年龄区间，却被拦下来说"请选择性别"——
   * 而性别明明早就填过了，前端也没在这个页面收集它。
   *
   * 择偶要求和档案本体是两张表、两个页面、两次保存，接口就该分开。
   */
  async upsertPreference(
    userId: string,
    dto: PreferenceInputDto,
    viewer: AuthUser,
  ): Promise<ProfileDto> {
    const profile = await this.prisma.profile.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    if (!profile) throw new BizException('请先完善你的基本资料', 40031);

    const data = this.preferenceData(dto);
    await this.prisma.$transaction(async (tx) => {
      await tx.preference.upsert({
        where: { profileId: profile.id },
        create: { profileId: profile.id, ...data },
        update: data,
      });
      // 择偶描述变了，旧的择偶向量就失效了
      await tx.profile.update({
        where: { id: profile.id },
        data: { prefEmbedding: Prisma.DbNull, embeddingUpdatedAt: null },
      });
    });

    // 传真实的 viewer，不要用 `as AuthUser` 造一个只有两个字段的假对象——
    // resolveViewer 会读 roles.includes，缺字段就是运行时 500。
    // 类型断言在这里帮了倒忙：它让编译器闭嘴，却没让对象变完整。
    return this.toDto(profile.id, viewer);
  }

  // ═══════ 录入路径 2：红娘代录 ═══════

  /**
   * 红娘代录线下地推来的资料。
   * 关键：**不需要对方有账号**——地推收上来的纸质表格先录进系统，
   * 本人之后注册时用编号认领（claim）。
   */
  async createByMatchmaker(
    matchmakerId: string,
    dto: MatchmakerCreateProfileDto,
    operator: { id: string; name: string; viewer?: AuthUser },
  ): Promise<ProfileDto> {
    if (dto.userId) {
      const taken = await this.prisma.profile.findFirst({
        where: { userId: dto.userId, deletedAt: null },
        select: { serialNo: true },
      });
      if (taken) throw new BizException(`该用户已有档案（${taken.serialNo}）`, 40910);
    }

    const created = await this.create(dto, {
      userId: dto.userId ?? null,
      source: ProfileSource.MATCHMAKER,
      matchmakerId,
    });

    if (dto.submitNow !== false) {
      await this.transition(created.id, ProfileStatus.PENDING, {
        operator,
        reason: '红娘代录后提交审核',
      });
    }
    // 关联了账号的话，那个人的上下文缓存也要清，否则他登录后系统仍以为他没档案
    if (dto.userId) await this.userContext.invalidate(dto.userId);
    // 同上：红娘代录完要能拿回档案，传 null 会因为档案还没过审而 404
    return this.toDto(created.id, operator.viewer ?? null);
  }

  /** 用户用编号认领红娘代录的档案 */
  async claim(userId: string, serialNo: string): Promise<ProfileDto> {
    const profile = await this.prisma.profile.findFirst({
      where: { serialNo, deletedAt: null },
    });
    if (!profile) throw new NotFoundException('档案编号不存在');
    if (profile.userId) {
      throw new BizException(
        profile.userId === userId ? '这份档案已经是你的了' : '该档案已被其他账号认领',
        40911,
      );
    }
    const mine = await this.prisma.profile.findFirst({
      where: { userId, deletedAt: null },
      select: { serialNo: true },
    });
    if (mine) throw new BizException(`你已有档案（${mine.serialNo}），不能重复认领`, 40912);

    await this.prisma.profile.update({ where: { id: profile.id }, data: { userId } });
    this.logger.log(`用户 ${userId} 认领了档案 ${serialNo}`);
    return this.toDto(profile.id, null);
  }

  // ═══════ 建 / 改 ═══════

  private async create(
    dto: UpsertProfileDto,
    meta: { userId: string | null; source: ProfileSource; matchmakerId: string | null },
  ): Promise<Profile> {
    const { normalized, errors } = await this.field.validateAndNormalize(dto.extras ?? {});
    if (errors.length) throw new BizException(errors.join('；'), 40030);

    return this.prisma.$transaction(async (tx) => {
      const serialNo = await this.prisma.nextSerial('profile', 'YQ', tx);

      const profile = await tx.profile.create({
        data: {
          // 先铺业务字段，再让这些系统字段覆盖，避免 coreFields 里的可选键把它们冲掉
          ...this.coreFields(dto),
          serialNo,
          userId: meta.userId,
          source: meta.source,
          matchmakerId: meta.matchmakerId,
          status: ProfileStatus.DRAFT,
          ...(dto.preference ? { preference: { create: this.preferenceData(dto.preference) } } : {}),
        },
      });

      await this.writeExtras(tx, profile.id, normalized);

      await tx.profileAuditLog.create({
        data: {
          profileId: profile.id,
          fromStatus: null,
          toStatus: ProfileStatus.DRAFT,
          reason: meta.source === ProfileSource.MATCHMAKER ? '红娘代录建档' : '用户自建档案',
          operatorId: meta.userId ?? meta.matchmakerId,
        },
      });

      return profile;
    });
  }

  private async update(
    existing: Profile,
    // 用部分类型：这三个方法本来就是「undefined 就不写」的语义，
    // 收窄成整份 DTO 只会挡住后台的单字段修改
    dto: AdminUpdateProfileDto,
    operator: { operatorId: string; operatorName: string },
    opts?: { skipReaudit?: boolean },
  ): Promise<void> {
    const { normalized, errors } = await this.field.validateAndNormalize(dto.extras ?? {});
    if (errors.length) throw new BizException(errors.join('；'), 40030);

    // 改了关键字段就要重新送审——已通过的资料被偷偷改成另一个人是这类系统的经典事故
    const changedKeyField = this.detectKeyFieldChange(existing, dto);
    const needReaudit =
      !opts?.skipReaudit && existing.status === ProfileStatus.APPROVED && changedKeyField;

    await this.prisma.$transaction(async (tx) => {
      await tx.profile.update({
        where: { id: existing.id },
        data: {
          ...this.coreFields(dto),
          // 自我介绍或择偶描述变了，旧向量就失效了，清掉等重算
          ...(dto.introduction !== undefined || dto.preference?.description !== undefined
            ? { introEmbedding: Prisma.DbNull, prefEmbedding: Prisma.DbNull, embeddingUpdatedAt: null }
            : {}),
        },
      });

      if (dto.preference) {
        await tx.preference.upsert({
          where: { profileId: existing.id },
          create: { profileId: existing.id, ...this.preferenceData(dto.preference) },
          update: this.preferenceData(dto.preference),
        });
      }

      await this.writeExtras(tx, existing.id, normalized);

      if (needReaudit) {
        await tx.profile.update({
          where: { id: existing.id },
          data: { status: ProfileStatus.PENDING },
        });
        await tx.profileAuditLog.create({
          data: {
            profileId: existing.id,
            fromStatus: existing.status,
            toStatus: ProfileStatus.PENDING,
            reason: `修改了关键字段（${changedKeyField}），自动重新送审`,
            operatorId: operator.operatorId,
            operatorName: operator.operatorName,
          },
        });
      }
    });
  }

  private detectKeyFieldChange(existing: Profile, dto: AdminUpdateProfileDto): string | null {
    for (const key of REAUDIT_FIELDS) {
      const next = (dto as unknown as Record<string, unknown>)[key];
      if (next === undefined) continue;
      const prev = (existing as unknown as Record<string, unknown>)[key];
      // 生日要按日期比，字符串直接比会误判
      if (key === 'birthday') {
        const a = prev instanceof Date ? prev.toISOString().slice(0, 10) : String(prev ?? '');
        if (a !== String(next).slice(0, 10)) return key;
        continue;
      }
      if (String(prev ?? '') !== String(next ?? '')) return key;
    }
    return null;
  }

  private coreFields(dto: AdminUpdateProfileDto) {
    // undefined 的字段不写（保持原值），null 才是"清空"
    const out: Prisma.ProfileUncheckedUpdateInput = {};
    const assign = <K extends keyof AdminUpdateProfileDto>(k: K) => {
      if (dto[k] !== undefined) (out as Record<string, unknown>)[k as string] = dto[k];
    };
    (
      [
        'realName', 'nickname', 'gender', 'heightCm', 'weightKg', 'education', 'school',
        'occupation', 'company', 'annualIncome', 'maritalStatus', 'childrenStatus',
        'houseStatus', 'carStatus', 'provinceCode', 'cityCode', 'districtCode',
        'hometownCityCode', 'introduction', 'phone', 'wechat',
      ] as (keyof AdminUpdateProfileDto)[]
    ).forEach(assign);

    if (dto.birthday !== undefined) out.birthday = new Date(dto.birthday);
    return out as Prisma.ProfileUncheckedCreateInput;
  }

  private preferenceData(p: PreferenceInputDto) {
    return {
      ageMin: p.ageMin ?? null,
      ageMax: p.ageMax ?? null,
      heightMin: p.heightMin ?? null,
      heightMax: p.heightMax ?? null,
      educationMin: p.educationMin ?? null,
      incomeMin: p.incomeMin ?? null,
      maritalStatus: (p.maritalStatus ?? []) as Prisma.InputJsonValue,
      childrenStatus: (p.childrenStatus ?? []) as Prisma.InputJsonValue,
      cityCodes: (p.cityCodes ?? []) as Prisma.InputJsonValue,
      requireHouse: p.requireHouse ?? false,
      requireCar: p.requireCar ?? false,
      description: p.description ?? null,
    };
  }

  /** 把扩展字段写进 EAV 表，按字段类型落到对应的列 */
  private async writeExtras(
    tx: Prisma.TransactionClient,
    profileId: string,
    values: Record<string, unknown>,
  ): Promise<void> {
    if (!Object.keys(values).length) return;

    const defs = await this.field.getEnabledFields();
    const byCode = new Map(defs.map((d) => [d.code, d]));

    for (const [code, v] of Object.entries(values)) {
      const def = byCode.get(code);
      // isCore 的字段已经写进固定列了，EAV 里不再存一份（会不一致）
      if (!def || def.isCore) continue;

      const data: Prisma.ProfileFieldValueUncheckedCreateInput = {
        profileId,
        fieldCode: code,
        valueText: null,
        valueNum: null,
        valueDate: null,
        valueJson: Prisma.DbNull,
      };

      if (v === null) {
        // 保留空行，表示"用户主动清空了"，与"从没填过"区分
      } else if (def.type === FieldType.NUMBER) {
        data.valueNum = Number(v);
      } else if (def.type === FieldType.DATE) {
        data.valueDate = new Date(v as string);
      } else if (
        def.type === FieldType.MULTI_SELECT ||
        def.type === FieldType.IMAGES ||
        def.type === FieldType.RANGE
      ) {
        data.valueJson = v as Prisma.InputJsonValue;
      } else if (def.type === FieldType.BOOLEAN) {
        data.valueNum = v ? 1 : 0;
      } else {
        data.valueText = String(v);
      }

      await tx.profileFieldValue.upsert({
        where: { profileId_fieldCode: { profileId, fieldCode: code } },
        create: data,
        update: {
          valueText: data.valueText,
          valueNum: data.valueNum,
          valueDate: data.valueDate,
          valueJson: data.valueJson ?? Prisma.DbNull,
        },
      });
    }
  }

  // ═══════ 审核状态机 ═══════

  /**
   * 状态流转的**唯一**入口。所有改 status 的地方都要走这里，
   * 因为这里做了三件事：校验合法流转、写审计日志、维护驳回理由。
   */
  async transition(
    profileId: string,
    target: ProfileStatus,
    opts: {
      operator: { id: string; name: string };
      reason?: string;
      rejectedFields?: string[];
    },
  ): Promise<void> {
    const profile = await this.prisma.profile.findFirst({
      where: { id: profileId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!profile) throw new NotFoundException('档案不存在');

    const from = profile.status as ProfileStatus;
    // 非法流转直接抛错，不会静默写库。
    // 转成 BizException：assertTransition 抛的是普通 Error，会被兜底过滤器
    // 当成 500 服务器错误——但「草稿不能直接置为通过」是调用方用错了，
    // 该给 400 和一句人能看懂的话，而不是让运营以为系统崩了。
    try {
      assertTransition(PROFILE_STATUS_TRANSITIONS, from, target, '档案状态');
    } catch (e) {
      throw new BizException((e as Error).message, 40033);
    }

    if (target === ProfileStatus.REJECTED && !opts.reason?.trim()) {
      throw new BizException('驳回必须填写理由，否则用户不知道要改什么', 40031);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.profile.update({
        where: { id: profileId },
        data: {
          status: target as PrismaProfileStatus,
          rejectReason: target === ProfileStatus.REJECTED ? (opts.reason ?? null) : null,
        },
      });
      await tx.profileAuditLog.create({
        data: {
          profileId,
          fromStatus: from as PrismaProfileStatus,
          toStatus: target as PrismaProfileStatus,
          reason: opts.reason ?? null,
          rejectedFields: (opts.rejectedFields ?? undefined) as Prisma.InputJsonValue | undefined,
          operatorId: opts.operator.id,
          operatorName: opts.operator.name,
        },
      });
    });

    this.logger.log(`档案 ${profileId} ${from} → ${target} by ${opts.operator.name}`);
  }

  /** 提交审核 */
  async submit(profileId: string, operator: { id: string; name: string }): Promise<void> {
    const profile = await this.prisma.profile.findFirst({
      where: { id: profileId, deletedAt: null },
      include: { photos: true },
    });
    if (!profile) throw new NotFoundException('档案不存在');

    // 提审前做完整性检查，别让审核员收到一堆残缺资料。
    //
    // 必填项从字段字典读，不写死：真实姓名被停用后这里仍然要求它，
    // 结果是字段填不了、档案也永远提交不了——写死的校验和可配的表单
    // 迟早会对不上，只能让校验跟着配置走。
    const required = (await this.field.getEnabledFields()).filter((f) => f.required && f.isCore);
    const record = profile as unknown as Record<string, unknown>;
    const missing: string[] = [];
    for (const f of required) {
      const v = record[f.code];
      if (v == null || (typeof v === 'string' && !v.trim())) missing.push(f.label);
    }
    // 照片不是字典里的列，单独判。红娘要看人，没照片撮合不了
    if (!profile.photos.length) missing.push('至少一张照片');
    if (missing.length) {
      throw new BizException(`资料不完整，请先补充：${missing.join('、')}`, 40032);
    }

    await this.transition(profileId, ProfileStatus.PENDING, { operator, reason: '提交审核' });
  }

  /** 后台审核 */
  async audit(
    profileId: string,
    dto: AuditProfileDto,
    operator: { id: string; name: string },
  ): Promise<void> {
    await this.transition(profileId, dto.targetStatus, {
      operator,
      reason: dto.reason,
      rejectedFields: dto.rejectedFields,
    });
  }

  async getAuditLogs(profileId: string): Promise<AuditLogDto[]> {
    const logs = await this.prisma.profileAuditLog.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
    });
    return logs.map((l) => ({
      id: l.id,
      fromStatus: l.fromStatus as ProfileStatus | null,
      toStatus: l.toStatus as ProfileStatus,
      reason: l.reason,
      operatorId: l.operatorId ?? '',
      operatorName: l.operatorName ?? '系统',
      createdAt: l.createdAt.toISOString(),
    }));
  }

  // ═══════ 照片 ═══════

  async addPhoto(
    profileId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    isPrimary = false,
  ) {
    const count = await this.prisma.profilePhoto.count({ where: { profileId } });
    if (count >= 9) throw new BizException('最多上传 9 张照片', 40033);

    const stored = await this.storage.savePhoto(file.buffer, file.originalname, file.mimetype);

    return this.prisma.$transaction(async (tx) => {
      if (isPrimary || count === 0) {
        await tx.profilePhoto.updateMany({ where: { profileId }, data: { isPrimary: false } });
      }
      return tx.profilePhoto.create({
        data: {
          profileId,
          url: stored.path,
          maskedUrl: stored.maskedPath,
          width: stored.width,
          height: stored.height,
          sizeBytes: stored.size,
          isPrimary: isPrimary || count === 0,
          sort: count,
        },
      });
    });
  }

  async auditPhoto(photoId: string, dto: AuditPhotoDto) {
    if (dto.status === 'REJECTED' && !dto.reason?.trim()) {
      throw new BizException('驳回照片必须填写理由', 40034);
    }
    return this.prisma.profilePhoto.update({
      where: { id: photoId },
      data: { auditStatus: dto.status, rejectReason: dto.reason ?? null },
    });
  }

  async deletePhoto(photoId: string, requesterProfileId: string | null, isAdmin: boolean) {
    const photo = await this.prisma.profilePhoto.findUnique({ where: { id: photoId } });
    if (!photo) throw new NotFoundException('照片不存在');
    if (!isAdmin && photo.profileId !== requesterProfileId) {
      throw new ForbiddenException('不能删除他人的照片');
    }
    await this.prisma.profilePhoto.delete({ where: { id: photoId } });
    // 删掉的是主图就把第一张顶上，不然列表页没头像
    if (photo.isPrimary) {
      const next = await this.prisma.profilePhoto.findFirst({
        where: { profileId: photo.profileId },
        orderBy: { sort: 'asc' },
      });
      if (next) {
        await this.prisma.profilePhoto.update({
          where: { id: next.id },
          data: { isPrimary: true },
        });
      }
    }
    return { success: true };
  }

  async setPrimaryPhoto(photoId: string) {
    const photo = await this.prisma.profilePhoto.findUnique({ where: { id: photoId } });
    if (!photo) throw new NotFoundException('照片不存在');
    await this.prisma.$transaction([
      this.prisma.profilePhoto.updateMany({
        where: { profileId: photo.profileId },
        data: { isPrimary: false },
      }),
      this.prisma.profilePhoto.update({ where: { id: photoId }, data: { isPrimary: true } }),
    ]);
    return { success: true };
  }

  // ═══════ 查询 ═══════

  /** 详情。一切对外输出都经过 PrivacyService.project()。 */
  async toDto(profileId: string, viewer: AuthUser | null): Promise<ProfileDto> {
    const profile = await this.prisma.profile.findFirst({
      where: { id: profileId, deletedAt: null },
      include: PROFILE_INCLUDE,
    });
    if (!profile) throw new NotFoundException('档案不存在');

    const ctx = await this.privacy.resolveViewer(profile, viewer);

    // 非本人/非管理员，只能看已通过的资料
    const isPrivileged = ctx.isSelf || ctx.isAdmin || ctx.isMatchmakerOf;
    if (!isPrivileged && profile.status !== 'APPROVED') {
      throw new NotFoundException('该会员资料不可见');
    }

    return this.privacy.project(profile, ctx);
  }

  /** 详情 + 计入浏览配额（小程序端用；后台看不扣次数） */
  async viewDetail(profileId: string, viewer: AuthUser): Promise<ProfileDto> {
    const dto = await this.toDto(profileId, viewer);
    const isSelf = dto.viewerLevel >= VisibilityLevel.ADMIN;
    if (!isSelf) {
      // 免费用户也允许看，只是没配额时不扣——扣不动就静默放过，
      // 不能因为"每日查看次数"把整个详情页拦死，那样新用户第一天就流失了。
      await this.privacy
        .recordView(viewer.userId, profileId, { consumeQuota: viewer.isVip })
        .catch((e: Error) => this.logger.debug(`记录浏览失败：${e.message}`));
    }
    return dto;
  }

  /** 后台/红娘列表 */
  async list(query: QueryProfileDto, viewer: AuthUser): Promise<PageResult<ProfileBriefDto>> {
    const where: Prisma.ProfileWhereInput = { deletedAt: null };

    const isAdmin =
      viewer.roles.includes(RoleCode.SUPER_ADMIN) ||
      viewer.roles.includes(RoleCode.ADMIN) ||
      viewer.roles.includes(RoleCode.AUDITOR);

    // 红娘只能看自己名下的会员 + 所有已通过的（用于牵线选人）
    if (!isAdmin) {
      if (!viewer.matchmakerId) throw new ForbiddenException('无权查看会员列表');
      where.OR = [{ matchmakerId: viewer.matchmakerId }, { status: 'APPROVED' }];
    }

    if (query.status) where.status = query.status;
    if (query.gender) where.gender = query.gender;
    if (query.cityCode) where.cityCode = query.cityCode;
    if (query.source) where.source = query.source;
    if (query.matchmakerId) where.matchmakerId = query.matchmakerId;
    if (query.hasPendingPhoto) where.photos = { some: { auditStatus: 'PENDING' } };

    if (query.ageMin != null || query.ageMax != null) {
      const r = ageRangeToBirthdayRange(query.ageMin, query.ageMax);
      where.birthday = { ...(r.gte ? { gte: r.gte } : {}), ...(r.lte ? { lte: r.lte } : {}) };
    }

    if (query.keyword?.trim()) {
      const kw = query.keyword.trim();
      where.AND = [
        {
          OR: [
            { serialNo: { contains: kw } },
            { realName: { contains: kw } },
            { nickname: { contains: kw } },
            { phone: { contains: kw } },
          ],
        },
      ];
    }

    const orderBy: Prisma.ProfileOrderByWithRelationInput = query.sortBy
      ? { [query.sortBy]: query.sortOrder }
      : { createdAt: 'desc' };

    const [rows, total] = await Promise.all([
      this.prisma.profile.findMany({
        where,
        orderBy,
        skip: query.skip,
        take: query.take,
        include: { photos: true },
      }),
      this.prisma.profile.count({ where }),
    ]);

    // 后台列表按管理员等级投影（红娘看自己名下的也给完整信息）
    const level = isAdmin ? VisibilityLevel.ADMIN : VisibilityLevel.MATCHMAKER;
    return buildPageResult(
      rows.map((r) => this.privacy.projectBrief(r, level)),
      total,
      query.page,
      query.pageSize,
    );
  }

  /** C 端广场：只有已通过的，且一律按访客等级脱敏 */
  async listPublic(query: QueryProfileDto, viewer: AuthUser | null): Promise<PageResult<ProfileBriefDto>> {
    const where: Prisma.ProfileWhereInput = { deletedAt: null, status: 'APPROVED' };

    // 只看异性，按本人性别自动定，不让用户选。
    // 相亲场景里"我要看男的还是女的"不是个需要问的问题，问了反而奇怪；
    // 而且同性档案混在广场里会让人以为系统坏了。
    // 没建档案的新用户还不知道性别，那就都给看——总比空着强。
    const self = viewer?.profileId
      ? await this.prisma.profile.findUnique({
          where: { id: viewer.profileId },
          select: { gender: true },
        })
      : null;

    if (self) where.gender = self.gender === 'MALE' ? 'FEMALE' : 'MALE';
    else if (query.gender) where.gender = query.gender;

    // 自己的档案不该出现在广场里
    if (viewer?.profileId) where.id = { not: viewer.profileId };

    if (query.cityCode) where.cityCode = query.cityCode;
    if (query.ageMin != null || query.ageMax != null) {
      const r = ageRangeToBirthdayRange(query.ageMin, query.ageMax);
      where.birthday = { ...(r.gte ? { gte: r.gte } : {}), ...(r.lte ? { lte: r.lte } : {}) };
    }

    const [rows, total] = await Promise.all([
      this.prisma.profile.findMany({
        where,
        // 置顶的排前面（VIP 权益），其次按活跃时间
        orderBy: [{ isTop: 'desc' }, { lastActiveAt: 'desc' }, { createdAt: 'desc' }],
        skip: query.skip,
        take: query.take,
        include: { photos: true },
      }),
      this.prisma.profile.count({ where }),
    ]);

    const level = !viewer
      ? VisibilityLevel.PUBLIC
      : viewer.isVip
        ? VisibilityLevel.VIP
        : VisibilityLevel.MEMBER;

    return buildPageResult(
      rows.map((r) => this.privacy.projectBrief(r, level)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async findRawById(id: string) {
    return this.prisma.profile.findFirst({
      where: { id, deletedAt: null },
      include: PROFILE_INCLUDE,
    });
  }

  async getMyProfileId(userId: string): Promise<string | null> {
    const p = await this.prisma.profile.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    return p?.id ?? null;
  }

  /** 软删除 */
  async remove(profileId: string): Promise<{ success: boolean }> {
    await this.prisma.profile.update({
      where: { id: profileId },
      data: { deletedAt: new Date(), status: 'OFFLINE' },
    });
    return { success: true };
  }

  /** 后台调整归属红娘 */
  async assignMatchmaker(profileId: string, matchmakerId: string | null): Promise<{ success: boolean }> {
    if (matchmakerId) {
      const mm = await this.prisma.matchmaker.findFirst({
        where: { id: matchmakerId, deletedAt: null },
        select: { id: true },
      });
      if (!mm) throw new NotFoundException('红娘不存在');
    }
    await this.prisma.profile.update({ where: { id: profileId }, data: { matchmakerId } });
    return { success: true };
  }
}
