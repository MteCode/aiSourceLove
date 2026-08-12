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
sudo cp $REMOTE_DIR/deploy/nginx.conf /etc/nginx/sites-available/yuanqiao
sudo sed -i "s|__ROOT__|$REMOTE_DIR|g; s|__SERVER_NAME__|$SSH_HOST|g" /etc/nginx/sites-available/yuanqiao
sudo ln -sf /etc/nginx/sites-available/yuanqiao /etc/nginx/sites-enabled/yuanqiao
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx || sudo systemctl restart nginx
REMOTE
  c_ok "Nginx 已配置（80 端口）"
}

restart_app() {
  c_info "重启后端"
  $SSH "sudo systemctl restart yuanqiao && sleep 3 && systemctl is-active yuanqiao"
  c_ok "已重启"
}

show_status() {
  $SSH "bash -s" <<'REMOTE'
echo "=== systemd ==="
systemctl is-active yuanqiao && systemctl status yuanqiao --no-pager -n 5 | tail -6
echo
echo "=== 容器 ==="
(docker ps --format "table {{.Names}}\t{{.Status}}" 2>/dev/null || sudo docker ps --format "table {{.Names}}\t{{.Status}}")
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
  *) c_err "未知命令：$1"; sed -n '3,14p' "$0"; exit 1 ;;
esac
