#!/usr/bin/env bash
#
# 缘桥 备份脚本（在服务器上跑，由 cron 每天调用）
#
#   ./backup.sh          备份数据库 + 上传目录
#   ./backup.sh db       只备份数据库
#   ./backup.sh verify   校验最近一次数据库备份能不能读
#
# 库里是真实客户资料，丢了没地方找回来，所以这个脚本必须能无人值守跑。
# 注意：备份落在同一块盘上，只防误删和坏迁移，不防磁盘损坏。
# 异地副本要从本机拉，见 deploy.sh backup-fetch。

set -euo pipefail

ROOT="${YQ_ROOT:-/home/ubuntu/yuanqiao}"
DEST="${YQ_BACKUP_DIR:-/home/ubuntu/backups}"
KEEP_DAYS="${YQ_BACKUP_KEEP:-30}"
STAMP="$(date +%Y%m%d-%H%M%S)"

cd "$ROOT"
# shellcheck disable=SC1091
set -a; source .env; set +a

DOCKER="docker"
docker ps >/dev/null 2>&1 || DOCKER="sudo docker"

log() { printf "[%s] %s\n" "$(date '+%F %T')" "$*"; }

backup_db() {
  mkdir -p "$DEST/db"
  local out="$DEST/db/yuanqiao-$STAMP.sql.gz"

  # --single-transaction：InnoDB 下不锁表，备份期间线上照常读写
  # --routines --triggers：存储过程和触发器也要带上，不然恢复出来是残的
  $DOCKER compose exec -T mysql mysqldump \
    -uroot -p"$MYSQL_ROOT_PASSWORD" \
    --single-transaction --routines --triggers --default-character-set=utf8mb4 \
    yuanqiao 2>/dev/null | gzip -9 > "$out"

  # gzip 是流式写的，中途失败也会留下个半截文件，所以必须验完整性再算数
  if ! gzip -t "$out" 2>/dev/null; then
    log "✘ 备份文件损坏，已删除：$out"
    rm -f "$out"
    return 1
  fi
  local size
  size=$(du -h "$out" | cut -f1)

  # 空库也能导出一个几 KB 的壳，光看文件存在不算数，得确认业务表真在里面。
  # 这里用 grep -c 而不是 grep -q：-q 命中后立刻退出会让上游 zcat 吃到 SIGPIPE，
  # 在 pipefail 下整条管道被判失败，"找到了"会被误读成"没找到"。
  if ! zcat "$out" | grep -c "CREATE TABLE \`biz_profile\`" >/dev/null; then
    log "✘ 备份里没有 biz_profile 表，已删除：$out"
    rm -f "$out"
    return 1
  fi

  log "✔ 数据库备份完成 $out（$size）"
  find "$DEST/db" -name 'yuanqiao-*.sql.gz' -mtime "+$KEEP_DAYS" -delete
  log "  保留最近 $KEEP_DAYS 天，当前 $(find "$DEST/db" -name 'yuanqiao-*.sql.gz' | wc -l) 份"
}

backup_uploads() {
  mkdir -p "$DEST/uploads"
  # 镜像而不是每天打包：照片 200M+ 且基本只增不改，
  # rsync 只传变化的部分，几秒就完事，天天打 tar 是纯浪费。
  rsync -a --delete "$ROOT/apps/server/uploads/" "$DEST/uploads/"
  log "✔ 上传目录已镜像（$(du -sh "$DEST/uploads" | cut -f1)，$(find "$DEST/uploads" -type f | wc -l) 个文件）"
}

verify_latest() {
  local latest
  latest=$(find "$DEST/db" -name 'yuanqiao-*.sql.gz' -print0 2>/dev/null | xargs -0 ls -t 2>/dev/null | head -1)
  [ -n "$latest" ] || { log "✘ 没有任何备份"; return 1; }

  gzip -t "$latest" || { log "✘ $latest 损坏"; return 1; }
  local tables rows
  tables=$(zcat "$latest" | grep -c '^CREATE TABLE')
  rows=$(zcat "$latest" | grep -c '^INSERT INTO')
  log "✔ $latest 可读：$tables 张表，$rows 条 INSERT 语句"
}

case "${1:-all}" in
  all)     backup_db; backup_uploads ;;
  db)      backup_db ;;
  uploads) backup_uploads ;;
  verify)  verify_latest ;;
  *)       echo "用法：$0 [all|db|uploads|verify]" >&2; exit 1 ;;
esac
