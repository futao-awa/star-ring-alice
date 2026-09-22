# 星环协议：爱丽丝 - 服务器部署指南

项目是一个无第三方运行依赖的 Node.js 应用，前端、游戏接口、工坊和管理后台由同一个服务提供。推荐使用 **Docker Compose + Nginx + HTTPS** 部署。

## 1. 部署文件说明

| 文件/目录 | 用途 | 是否需要部署 |
| --- | --- | --- |
| `server.js`、HTML、CSS、JS、`assets/` | 游戏与服务主体 | 是 |
| `package.json` | Node.js 版本与启动命令 | 是 |
| `Dockerfile`、`compose.yaml` | Docker 部署 | Docker 方式需要 |
| `.env.example` | 生产环境变量模板 | 复制为 `.env` 后使用 |
| `deploy/nginx.conf.example` | 域名反向代理模板 | 推荐 |
| `deploy/neon-rift.service` | systemd 服务模板 | 仅原生 Node.js 方式需要 |
| `DEPLOYMENT.md` | 本文档 | 建议保留 |
| `THIRD_PARTY_ASSETS.md` | 素材来源记录 | 建议保留 |
| 七个 JSON 文件 | 排名、用户、关卡等运行数据 | 仅迁移旧数据时复制到数据目录 |

七个持久化数据文件为：

```text
rankings.json
levels.json
shares.json
users.json
reviews.json
announcements.json
mail.json
```

## 2. 上线前准备

- 一台 64 位 Linux 服务器，建议 Ubuntu 22.04/24.04，最低 1 核 CPU、1 GB 内存。
- 一个解析到服务器公网 IP 的域名，例如 `game.example.com`。
- 防火墙只放行 SSH、80 和 443；不要把 4174 端口直接暴露到公网。
- 生成一个从未在其他网站使用过的管理员强密码，至少 12 位。

生产环境首次创建空数据目录时，会根据环境变量创建管理员，并且不会创建 `creator_test` 测试账号。管理员变量只负责首次初始化；已有 `users.json` 时不会自动覆盖账号或密码。

## 3. 推荐方式：Docker Compose

### 3.1 安装环境

安装 Docker Engine 和 Compose 插件后，把整个项目目录上传到服务器，例如：

```bash
sudo mkdir -p /opt/neon-rift
sudo chown "$USER":"$USER" /opt/neon-rift
cd /opt/neon-rift
```

确认此目录中能看到 `server.js`、`Dockerfile` 和 `compose.yaml`。

### 3.2 设置生产参数

```bash
cp .env.example .env
nano .env
chmod 600 .env
mkdir -p data
sudo chown -R 1000:1000 data
```

至少修改以下三项，禁止继续使用示例值：

```dotenv
ADMIN_ACCOUNT=futao_admin_prod
ADMIN_DISPLAY_NAME=后台显示名称
ADMIN_PASSWORD=独立且不少于12位的强密码
```

其余推荐保持：

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=4174
DATA_DIR=/app/data
```

不要把 `.env` 上传到公开仓库或发给他人。

### 3.3 可选：迁移当前本地数据

如果要保留本地排名、创作者、审核记录和公告，在首次启动前，把上述七个 JSON 文件复制到服务器的 `/opt/neon-rift/data/`，然后执行：

```bash
sudo chown -R 1000:1000 /opt/neon-rift/data
```

迁移 `users.json` 会同时迁移现有账号和密码摘要。环境变量不会覆盖已存在的管理员，因此上线后应立即在管理后台重设不需要的测试账号，或停用它们。

### 3.4 启动并检查

```bash
cd /opt/neon-rift
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:4174/api/health
```

健康接口应返回 `"ok":true`。查看日志：

```bash
docker compose logs --tail=100 neon-rift
```

### 3.5 配置 Nginx 与 HTTPS

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/neon-rift
sudo nano /etc/nginx/sites-available/neon-rift
```

把配置中的 `game.example.com` 换成真实域名，然后：

```bash
sudo ln -s /etc/nginx/sites-available/neon-rift /etc/nginx/sites-enabled/neon-rift
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d game.example.com
```

之后通过 `https://你的域名/` 访问游戏；管理后台路径为 `/admin.html`，创作者工坊为 `/editor.html`。

## 4. 备选方式：原生 Node.js + systemd

服务器需安装 Node.js 20 或更高版本。程序放在 `/opt/neon-rift/app`，数据放在 `/var/lib/neon-rift`：

```bash
sudo useradd --system --home /opt/neon-rift --shell /usr/sbin/nologin neon-rift
sudo mkdir -p /opt/neon-rift/app /var/lib/neon-rift
sudo chown -R neon-rift:neon-rift /opt/neon-rift /var/lib/neon-rift
```

上传程序后创建 `/etc/neon-rift.env`：

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=4174
DATA_DIR=/var/lib/neon-rift
ADMIN_ACCOUNT=你的管理员账号
ADMIN_DISPLAY_NAME=后台显示名称
ADMIN_PASSWORD=独立且不少于12位的强密码
```

保护环境文件并启用服务：

```bash
sudo chmod 600 /etc/neon-rift.env
sudo chown root:root /etc/neon-rift.env
sudo cp /opt/neon-rift/app/deploy/neon-rift.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now neon-rift
sudo systemctl status neon-rift
curl http://127.0.0.1:4174/api/health
```

Nginx 和 HTTPS 配置与 Docker 方式相同。

## 5. 更新版本且不丢数据

更新前先备份。Docker 方式替换程序文件时，不要删除 `data/` 和 `.env`：

```bash
cd /opt/neon-rift
docker compose down
# 上传或替换新版程序文件，保留 data/ 与 .env
docker compose up -d --build
curl http://127.0.0.1:4174/api/health
```

原生方式则保留 `/var/lib/neon-rift`，替换 `/opt/neon-rift/app` 后执行：

```bash
sudo systemctl restart neon-rift
```

## 6. 备份与恢复

Docker 方式备份：

```bash
cd /opt/neon-rift
tar -czf "neon-rift-data-$(date +%F-%H%M).tar.gz" -C data \
  rankings.json levels.json shares.json users.json reviews.json announcements.json mail.json
```

建议每天自动备份，并把备份同步到另一台机器或对象存储。恢复时先停服，解压到原数据目录，再恢复权限：

```bash
docker compose down
tar -xzf neon-rift-data-YYYY-MM-DD-HHMM.tar.gz -C data
sudo chown -R 1000:1000 data
docker compose up -d
```

原生部署把 `data` 替换为 `/var/lib/neon-rift`，并将所有者恢复为 `neon-rift:neon-rift`。

## 7. 上线检查清单

- 域名只通过 HTTPS 访问，HTTP 自动跳转 HTTPS。
- 4174 仅监听本机或通过 Docker 映射到 `127.0.0.1`。
- `.env` 或 `/etc/neon-rift.env` 权限为 600，且不进入代码仓库。
- 不使用本地默认账号与默认密码；迁移数据后停用 `creator_test`。
- `/api/health` 正常，首页、星图、工坊登录、后台登录均能打开。
- 创建一次公告并刷新确认数据可以写入，随后做一次完整备份。
- 定期更新系统、Docker/Node.js 和 Nginx。

## 8. 当前部署边界

目前账号会话保存在进程内存，服务重启后创作者和管理员需要重新登录。业务数据使用 JSON 文件，适合单台服务器、小到中等访问量；**只能运行一个应用副本**，不能使用多个容器共享同一数据目录。若访问量明显增长，应把用户、排行、审核和关卡数据迁移到 PostgreSQL，并使用 Redis 保存会话后再做多实例扩容。
