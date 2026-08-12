#!/usr/bin/env bash
#
# 缘桥 部署脚本（在本机执行，推到远端 Linux 服务器）
#
#   ./deploy/deploy.sh              全量部署
#   ./deploy/deploy.sh code         只推代码 + 重启（最常用，秒级）
#   ./deploy/deploy.sh infra        只起 MySQL/Redis
#   ./deploy/deploy.sh db           只跑迁移 + 种子
#   ./deploy/deploy.sh logs         看后端日志
#   ./deploy/deploy.sh status       看运行状态
#
#   ./deploy/deploy.sh backup-setup  装每日备份 cron（装一次就行）
#   ./deploy/deploy.sh backup        立即备份一次
#   ./deploy/deploy.sh backup-verify 校验最近一次备份能不能读
#   ./deploy/deploy.sh backup-fetch  把远端备份拉到本机（可选，手动触发，绝不自动跑）
#
#   ./deploy/deploy.sh https <域名>  签 HTTPS 证书并开启 80→443 跳转
#
# 前提：本机 ~/.ssh 里有能免密登录目标机的私钥。

set -euo pipefail

# ── 配置 ──
SSH_HOST="${YQ_SSH_HOST:-42.193.176.69}"
SSH_USER="${YQ_SSH_USER:-ubuntu}"
SSH_KEY="${YQ_SSH_KEY:-$HOME/.ssh/mac_mate.pem}"
REMOTE_DIR="${YQ_REMOTE_DIR:-/home/ubuntu/yuanqiao}"

SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 $SSH_USER@$SSH_HOST"
LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

c_ok()   { printf "\033[32m✔\033[0m %s\n" "$*"; }
c_info() { printf "\033[36m▸\033[0m %s\n" "$*"; }
c_warn() { printf "\033[33m!\033[0m %s\n" "$*"; }
c_err()  { printf "\033[31m✘\033[0m %s\n" "$*" >&2; }

# ── 推代码 ──
push_code() {
  c_info "同步代码到 $SSH_USER@$SSH_HOST:$REMOTE_DIR"
  $SSH "mkdir -p $REMOTE_DIR"
  rsync -az --delete \
    -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new" \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude '.git' \
    --exclude 'uploads' \
    --exclude '.env' \
    --exclude 'apps/client/unpackage' \
    --exclude '*.log' \
    "$LOCAL_DIR/" "$SSH_USER@$SSH_HOST:$REMOTE_DIR/"
  c_ok "代码已同步"
}

# ── 远端 .env ──
# 不同步本地 .env（里面是本地配置），远端第一次部署时生成一份独立的
ensure_env() {
  c_info "检查远端 .env"
  $SSH "bash -s" <<REMOTE
set -e
cd $REMOTE_DIR
if [ ! -f .env ]; then
  cp .env.example .env
  # 生成强随机密钥与库密码，避免线上用样例值
  JWT=\$(openssl rand -hex 32)
  DBPWD=\$(openssl rand -hex 16)
  ROOTPWD=\$(openssl rand -hex 16)
  sed -i "s|^NODE_ENV=.*|NODE_ENV=production|" .env
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=\$JWT|" .env
  sed -i "s|^MYSQL_PASSWORD=.*|MYSQL_PASSWORD=\$DBPWD|" .env
  sed -i "s|^MYSQL_ROOT_PASSWORD=.*|MYSQL_ROOT_PASSWORD=\$ROOTPWD|" .env
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"mysql://yuanqiao:\$DBPWD@127.0.0.1:3306/yuanqiao\"|" .env
  sed -i "s|^PUBLIC_BASE_URL=.*|PUBLIC_BASE_URL=http://$SSH_HOST|" .env
  chmod 600 .env
  echo "已生成新的 .env（含随机 JWT_SECRET 与库密码）"
else
  echo ".env 已存在，保持不变"
fi
# apps/server/.env 软链，供 Prisma CLI 读取
ln -sfn ../../.env apps/server/.env
REMOTE
  c_ok ".env 就绪"
}

# ── 基础设施 ──
setup_infra() {
  c_info "启动 MySQL + Redis"
  $SSH "bash -s" <<REMOTE
set -e
cd $REMOTE_DIR
# ubuntu 用户不在 docker 组时用 sudo
DOCKER="docker"
if ! docker ps >/dev/null 2>&1; then DOCKER="sudo docker"; fi
\$DOCKER compose --env-file .env up -d
echo "等待 MySQL 就绪…"
for i in \$(seq 1 60); do
  if \$DOCKER compose exec -T mysql mysqladmin ping -h127.0.0.1 --silent >/dev/null 2>&1; then
    echo "MySQL 已就绪"; break
  fi
  sleep 2
  if [ \$i -eq 60 ]; then echo "MySQL 启动超时"; exit 1; fi
done
REMOTE
  c_ok "MySQL + Redis 运行中"
}

# ── 安装依赖 + 构建 ──
build_remote() {
  c_info "远端安装依赖并构建（首次较慢）"
  $SSH "bash -s" <<REMOTE
set -e
cd $REMOTE_DIR
export npm_config_cache=$REMOTE_DIR/.npm-cache
# 必须带 optional 依赖：sharp 的原生二进制是按平台走 optionalDependencies 分发的
npm install --no-audit --no-fund
npm run build:shared
cd apps/server && npx prisma generate && npx nest build
cd $REMOTE_DIR
# 两个前端也必须构建：nginx 发的是它们的产物目录，漏掉就是 404
npm run build:admin
npm run build:client
REMOTE
  c_ok "构建完成"
}

# ── 数据库 ──
migrate_db() {
  c_info "同步数据库结构并写入种子数据"
  $SSH "bash -s" <<REMOTE
set -e
cd $REMOTE_DIR/apps/server
npx prisma db push --skip-generate --accept-data-loss
npx tsx prisma/seed.ts
REMOTE
  c_ok "数据库就绪"
}

# ── systemd ──
setup_service() {
  c_info "安装 systemd 服务"
  $SSH "bash -s" <<REMOTE
set -e
# systemd 不走登录 shell，PATH 里没有 /usr/local/bin，
# 必须把 node 的真实路径解析出来写进 unit，否则 203/EXEC
NODE_BIN=\$(command -v node)
if [ -z "\$NODE_BIN" ]; then
  echo "找不到 node，请先安装" >&2
  exit 1
fi
sudo tee /etc/systemd/system/yuanqiao.service >/dev/null <<UNIT
[Unit]
Description=YuanQiao API (缘桥)
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=$SSH_USER
WorkingDirectory=$REMOTE_DIR/apps/server
EnvironmentFile=$REMOTE_DIR/.env
ExecStart=\$NODE_BIN dist/main.js
Restart=always
RestartSec=5
StandardOutput=append:/var/log/yuanqiao.log
StandardError=append:/var/log/yuanqiao.log
# 3.6G 内存的机器，给 Node 限个上限免得 OOM 把 MySQL 拖死
Environment=NODE_OPTIONS=--max-old-space-size=768

[Install]
WantedBy=multi-user.target
UNIT
sudo touch /var/log/yuanqiao.log && sudo chown $SSH_USER:$SSH_USER /var/log/yuanqiao.log
sudo systemctl daemon-reload
sudo systemctl enable yuanqiao
sudo systemctl restart yuanqiao
REMOTE
  c_ok "systemd 服务已启动"
}

# ── Nginx ──
setup_nginx() {
  c_info "配置 Nginx"
  $SSH "bash -s" <<REMOTE
set -e
if ! command -v nginx >/dev/null 2>&1; then
  sudo apt-get update -qq && sudo apt-get install -y -qq nginx
fi
# nginx 以 www-data 跑，要能穿过家目录才读得到静态文件和上传目录。
# Ubuntu 默认 /home/<user> 是 750，不加这一下首页直接 500。
sudo chmod o+x "\$(dirname $REMOTE_DIR)"
sudo cp $REMOTE_DIR/deploy/nginx.conf /etc/nginx/sites-available/yuanqiao
sudo sed -i "s|__ROOT__|$REMOTE_DIR|g; s|__SERVER_NAME__|$SSH_HOST|g" /etc/nginx/sites-available/yuanqiao
sudo ln -sf /etc/nginx/sites-available/yuanqiao /etc/nginx/sites-enabled/yuanqiao
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx || sudo systemctl restart nginx
REMOTE
  c_ok "Nginx 已配置（80 端口）"
}

# ── HTTPS ──
# 前提：域名已解析到本机 IP，且已完成 ICP 备案。
# 没备案的话腾讯云会拦掉 80 端口，certbot 的 HTTP-01 验证根本走不通，
# 报错会是「Timeout during connect」，看起来像防火墙问题，其实是备案问题。
setup_https() {
  local domain="${1:-}"
  if [ -z "$domain" ]; then
    c_err "用法：./deploy/deploy.sh https your-domain.com"
    exit 1
  fi

  c_info "检查 $domain 是否解析到本机"
  local resolved
  resolved=$(dig +short "$domain" A 2>/dev/null | tail -1)
  if [ "$resolved" != "$SSH_HOST" ]; then
    c_warn "$domain 解析到 ${resolved:-（无记录）}，而服务器是 $SSH_HOST"
    c_warn "DNS 没生效就签不了证书。确认腾讯云 DNS 里 A 记录指向 $SSH_HOST 再重试。"
    exit 1
  fi
  c_ok "解析正确"

  $SSH "bash -s" <<REMOTE
set -e
if ! command -v certbot >/dev/null 2>&1; then
  sudo apt-get update -qq && sudo apt-get install -y -qq certbot python3-certbot-nginx
fi

# 先把 server_name 换成真域名，certbot --nginx 是靠它定位 server 块的
sudo sed -i "s/server_name .*/server_name $domain;/" /etc/nginx/sites-available/yuanqiao
sudo nginx -t && sudo systemctl reload nginx

# --redirect 自动加 80→443 跳转；小程序和微信支付回调都强制 https，必须有
sudo certbot --nginx -d $domain --non-interactive --agree-tos --redirect \
  --register-unsafely-without-email

# 证书 90 天有效，certbot 装好后会自带 systemd timer 自动续期，这里确认它开着
sudo systemctl enable --now certbot.timer 2>/dev/null || true
sudo certbot renew --dry-run 2>&1 | tail -3

# 必须和签证书在同一段里做完：接口下发的图片地址是用 PUBLIC_BASE_URL 拼的，
# 页面走 https 而图片还是 http，浏览器按混合内容直接拦掉，图全裂且控制台没有网络请求。
cd $REMOTE_DIR
sed -i "s|^PUBLIC_BASE_URL=.*|PUBLIC_BASE_URL=https://$domain|" .env
sudo systemctl restart yuanqiao
REMOTE
  c_ok "HTTPS 已启用，PUBLIC_BASE_URL 已同步"

  echo
  c_ok "完成 → https://$domain"
  c_warn "小程序还要：把 $domain 填进 apps/client/.env.production 的 VITE_API_BASE_MP，"
  c_warn "然后 npm run build:mp；并在微信公众平台配 request 合法域名。"
}

# ── 备份 ──
setup_backup() {
  c_info "安装每日备份 cron"
  $SSH "bash -s" <<REMOTE
set -e
chmod +x $REMOTE_DIR/deploy/backup.sh
mkdir -p /home/$SSH_USER/backups
# 每天凌晨 4 点，避开 1/2/3 点那几个业务定时任务
# 经由临时文件安装：这段脚本本身是从 ssh 的 stdin 喂给 bash 的，
# 让 crontab 直接从管道读会跟它抢同一个流，装出来是空的。
TMP=\$(mktemp)
crontab -l 2>/dev/null | grep -v 'deploy/backup.sh' > "\$TMP" || true
# 每天凌晨 4 点，避开 1/2/3 点那几个业务定时任务
echo "0 4 * * * $REMOTE_DIR/deploy/backup.sh all >> /var/log/yuanqiao-backup.log 2>&1" >> "\$TMP"
crontab "\$TMP"
rm -f "\$TMP"
sudo touch /var/log/yuanqiao-backup.log
sudo chown $SSH_USER:$SSH_USER /var/log/yuanqiao-backup.log
echo "已装 cron："
crontab -l | grep backup.sh
REMOTE
  c_ok "每日 04:00 自动备份"
}

run_backup() {
  c_info "立即执行一次备份"
  $SSH "$REMOTE_DIR/deploy/backup.sh ${1:-all}"
}

# 备份和线上数据在同一块盘，只防误删不防盘坏，异地副本得拉到本机
fetch_backup() {
  local dir="${YQ_LOCAL_BACKUP:-$LOCAL_DIR/.backups}"
  c_warn "拉下来的是真实客户资料，别放进仓库、别传到网盘"
  mkdir -p "$dir"
  c_info "同步远端备份到 $dir"
  rsync -az --info=stats2 \
    -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new" \
    "$SSH_USER@$SSH_HOST:/home/$SSH_USER/backups/" "$dir/" 2>/dev/null \
    || rsync -az -e "ssh -i $SSH_KEY" "$SSH_USER@$SSH_HOST:/home/$SSH_USER/backups/" "$dir/"
  c_ok "本地副本：$dir（$(du -sh "$dir" | cut -f1)）"
}

restart_app() {
  c_info "重启后端"
  $SSH "sudo systemctl restart yuanqiao && sleep 3 && systemctl is-active yuanqiao"
  c_ok "已重启"
}

show_status() {
  # heredoc 用引号包着不做本地展开，所以 REMOTE_DIR 得当参数传进去
  $SSH "bash -s -- $REMOTE_DIR" <<'REMOTE'
cd "$1" || exit 1
echo "=== systemd ==="
systemctl is-active yuanqiao && systemctl status yuanqiao --no-pager -n 5 | tail -6
echo
echo "=== 容器 ==="
(docker ps --format "table {{.Names}}\t{{.Status}}" 2>/dev/null || sudo docker ps --format "table {{.Names}}\t{{.Status}}")
echo
echo "=== 对外地址一致性 ==="
# 这一项单独检查，是因为它错了不会报错，只会让页面上的图全裂：
# 接口下发的图片地址用 PUBLIC_BASE_URL 拼，站点是 https 而它是 http 时，
# 浏览器按混合内容静默拦截，服务端日志里什么都看不到。
BASE=$(grep -m1 "^PUBLIC_BASE_URL=" .env | cut -d= -f2-)
echo "PUBLIC_BASE_URL = $BASE"
# 用"443 有没有在监听"判断是否已上 HTTPS——读 /etc/letsencrypt 要 root
if ss -lnt 2>/dev/null | grep -q ":443 "; then
  if [ "${BASE#https://}" = "$BASE" ]; then
    echo "  !! 已装 HTTPS 证书，但 PUBLIC_BASE_URL 还是 http —— 图片会被浏览器当混合内容拦掉"
    echo "     修：./deploy/deploy.sh https <域名>"
  else
    echo "  与 HTTPS 一致"
  fi
fi
echo
echo "=== 健康检查 ==="
curl -s -m 5 http://127.0.0.1:3000/health || echo "后端无响应"
echo
echo "=== 内存 ==="
free -h | head -2
REMOTE
}

show_logs() {
  $SSH "tail -n 80 -f /var/log/yuanqiao.log"
}

# ── 主流程 ──
case "${1:-all}" in
  all)
    push_code; ensure_env; setup_infra; build_remote; migrate_db; setup_service; setup_nginx
    echo; c_ok "部署完成 → http://$SSH_HOST"
    show_status
    ;;
  code)    push_code; build_remote; restart_app ;;
  infra)   ensure_env; setup_infra ;;
  db)      migrate_db; restart_app ;;
  service) setup_service ;;
  nginx)   setup_nginx ;;
  status)  show_status ;;
  logs)    show_logs ;;
  backup-setup) push_code; setup_backup; run_backup ;;
  backup)  run_backup "${2:-all}" ;;
  backup-verify) run_backup verify ;;
  backup-fetch)  fetch_backup ;;
  https)   setup_https "${2:-}" ;;
  *) c_err "未知命令：$1"; sed -n '3,14p' "$0"; exit 1 ;;
esac
