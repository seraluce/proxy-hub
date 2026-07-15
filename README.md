# Proxy Hub

Cloudflare Workers 代理工具集，持续增加新功能。

## 功能列表

| 功能 | 路径 | 说明 |
|------|------|------|
| GitHub 加速 | `/gh/https://github.com/...` | Release、Archive、Raw 文件下载 |
| Git Clone | `git clone https://域名/gh/https://github.com/.../repo.git` | 仓库克隆加速 |
| 直连规则 | `/rules/direct` | 中国域名直连规则 TXT |
| Clash 规则 | `/rules/clash` | Clash 格式规则 |

## 快速部署

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 创建 Worker，粘贴 `worker.js` 内容
3. 绑定自定义域名
4. 开始使用

## 使用示例

```bash
# GitHub Release 加速下载
https://your-domain/gh/https://github.com/user/repo/releases/download/v1.0/app.zip

# Git Clone 加速
git clone https://your-domain/gh/https://github.com/user/repo.git

# 下载直连规则
https://your-domain/rules/direct
https://your-domain/rules/clash
```

## 路由结构

| 路径 | 功能 |
|------|------|
| `/` | 使用说明页面 |
| `/gh/*` | GitHub 加速代理 |
| `/rules/*` | 直连规则订阅 |

## 规则数据来源

- **geosite.dat**: v2fly 社区维护的域名分类数据 (cn/gov/edu/mil)
- **自定义规则**: 在 `custom.txt` 中添加

## 自动更新

GitHub Actions 每天 UTC 6:00 自动更新规则，也可手动触发。

## 文件说明

| 文件 | 说明 |
|------|------|
| `worker.js` | Worker 主程序（所有功能） |
| `direct.txt` | 直连域名列表 |
| `direct_clash.yaml` | Clash 格式规则 |
| `sources.txt` | 外部规则源 URL |
| `custom.txt` | 自定义域名规则 |
| `.github/workflows/merge.yml` | 自动更新工作流 |

## 本地开发

```bash
git clone https://github.com/your-name/proxy-hub.git
cd proxy-hub
npx wrangler dev
```

## License

MIT