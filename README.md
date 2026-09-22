# 星环协议：爱丽丝

一个网页像素节奏弹幕射击游戏。爱丽丝在一次异常跃迁后被困于未知星区，必须净化失控行星，重新启动回家的星门。

纯前端可运行，无需外部依赖，支持键盘与触屏操作。

## 游戏特色

- 三向轨道炮射击、擦弹判定、节拍反馈与命中停顿
- Boss 定格登场、预警激光、多形态弹幕（圆环、五角星、矩形扩散、分裂核心弹）
- 轨道轰击技能：贯穿式多层激光演出
- 可漫游星图、折跃动画、分星系排行榜
- 巡航模式（新手友好）与深空警戒（高难度）
- 多轨关卡编辑器（工坊）与内容管理后台
- 程序化生成的战斗音乐与待机音乐

## 快速开始

需要 [Node.js](https://nodejs.org/) 20 或更高版本。

```bash
# 克隆仓库
git clone https://github.com/futao-awa/star-ring-alice.git
cd star-ring-alice

# 启动服务
node server.js
```

打开浏览器访问 `http://127.0.0.1:4174/` 即可开始游戏。

## 操作说明

| 操作 | 键盘 | 触屏 |
|------|------|------|
| 移动 | 方向键 / WASD | 拖动角色 |
| 射击 | Z / K / 空格 | 按住画面（自动射击） |
| 低速收束 | Shift | — |
| 轨道轰击 | X | 右下角按钮 |
| 暂停 | P / Esc | 顶部暂停按钮 |

访问 `?qa=1` 可启用调试快捷键：`N` 推进状态、`B` 技能演出、`C` 连击测试、`H` 受击测试、`V` 射击定格、`L` 激光测试、`I` 切换无敌。

## 项目结构

```
├── server.js            # Node.js 服务端（静态文件 + 排名 API）
├── index.html           # 标题页
├── play.html / play.js  # 游戏主页面
├── game.js              # 游戏核心逻辑
├── player.js            # 玩家控制
├── barrage-engine.js    # 弹幕引擎
├── music-engine.js      # 音乐引擎
├── editor.html/js/css   # 多轨关卡编辑器（工坊）
├── admin.html/js/css    # 内容管理后台
├── privacy.html/css     # 隐私政策页
├── styles.css           # 全局样式
├── assets/              # 精灵图、音频等素材
├── Dockerfile           # Docker 构建文件
├── compose.yaml         # Docker Compose 配置
└── DEPLOYMENT.md        # 部署文档
```

## 工坊与管理端

- 关卡编辑器：`http://127.0.0.1:4174/editor.html`
- 管理后台：`http://127.0.0.1:4174/admin.html`

工坊发布的关卡需经管理员审核后才会进入公开星图。管理员可生成试玩链接、审核关卡、管理创作者账号和发布公告。

## 部署

生产环境推荐使用 Docker Compose 配合 Nginx 反向代理与 HTTPS。

```bash
# Docker Compose 部署
docker compose up -d
```

支持的环境变量：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `HOST` | 监听地址 | `0.0.0.0` |
| `PORT` | 监听端口 | `4174` |
| `DATA_DIR` | 数据存储目录 | `./data` |
| `NODE_ENV` | 运行环境 | `production` |
| `ADMIN_ACCOUNT` | 管理员账号 | — |
| `ADMIN_DISPLAY_NAME` | 管理员显示名 | — |
| `ADMIN_PASSWORD` | 管理员密码（不少于 12 位） | — |

运行状态可通过 `GET /api/health` 检查。完整部署说明见 [DEPLOYMENT.md](DEPLOYMENT.md)。

## 技术栈

- **前端**：原生 HTML / CSS / JavaScript（Canvas 2D）
- **后端**：Node.js（Express 风格路由）
- **数据存储**：JSON 文件
- **容器化**：Docker / Docker Compose

## 许可证

本项目基于 [GNU General Public License v3.0](LICENSE) 开源。

---

> 星环协议：爱丽丝 — 像素弹幕 · 节奏射击 · 深空冒险
