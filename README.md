# gh-proxy

## 简介

GitHub Release、Archive 及项目文件的加速项目，支持 Clone、文件下载、Raw 文件访问。基于 **Cloudflare Workers** 构建，最大化利用免费服务实现边缘加速。

## 特性

- **双层缓存架构** — Cloudflare Cache API (边缘缓存) + Workers KV (持久缓存)，自动降级
- **请求去重** — 相同 URL 并发请求自动合并，减少上游压力
- **jsDelivr CDN 跳转** — 代码文件自动跳转 jsDelivr 加速
- **完整 CORS 支持** — 可直接在前端 fetch 使用
- **现代 UI** — 深色/浅色主题、拖拽粘贴、剪贴板操作、Toast 通知
- **免费额度** — Workers 10万次/天、KV 10万读/天、Cache API 无限制

## Cloudflare 免费服务利用

| 服务 | 用途 | 免费额度 |
|------|------|---------|
| Workers | 边缘计算 | 10万次请求/天 |
| Workers KV | 大文件持久缓存 | 10万次读/天，1000次写/天 |
| Cache API | 边缘节点缓存 | 无限制 |
| Cloudflare CDN | 自动加速 | 免费 |

## 使用

直接在 GitHub URL 前加上你的 Worker 域名即可：

```
https://你的域名/https://github.com/user/repo/releases/download/v1.0/file.zip
```

或直接访问 Worker 页面，在输入框中粘贴 GitHub 链接。

### 支持的链接类型

- Release 下载: `https://github.com/user/repo/releases/download/v1.0/file.zip`
- Archive 源码: `https://github.com/user/repo/archive/refs/heads/main.zip`
- 分支文件: `https://github.com/user/repo/blob/main/filename`
- Raw 文件: `https://raw.githubusercontent.com/user/repo/main/file`
- Gist: `https://gist.githubusercontent.com/user/id/raw/file`

### 私有仓库

```
git clone https://user:TOKEN@你的域名/https://github.com/xxxx/xxxx
```

## 部署

### Cloudflare Workers (推荐)

1. 注册 [Cloudflare Workers](https://workers.cloudflare.com)
2. 创建一个 Worker
3. 复制 `index.js` 和 `html.js` 到 Worker 编辑器
4. 绑定 KV 命名空间 (设置 -> KV -> 创建命名空间，绑定名填 `GH_CACHE`)
5. 部署

或使用 Wrangler CLI:

```bash
npm install
npx wrangler deploy
```

### 自动部署 (GitHub Actions)

1. Fork 仓库
2. 在仓库设置中添加 Secrets:
   - `CF_API_TOKEN`: Cloudflare API Token
   - `CF_ACCOUNT_ID`: Cloudflare Account ID
3. Push 到 `main` 分支即可自动部署

### 自定义域名

在 `wrangler.toml` 中取消注释 routes 配置:

```toml
routes = [
    { pattern = "gh-proxy.example.com/*", zone_name = "example.com" }
]
```

## 配置项

编辑 `index.js` 中的 `CONFIG` 对象:

| 配置 | 默认值 | 说明 |
|------|--------|------|
| `PREFIX` | `/` | URL 前缀 |
| `JSDELIVR` | `1` | 代码文件是否跳转 jsDelivr |
| `ENABLE_KV_CACHE` | `true` | 是否启用 KV 缓存 |
| `KV_CACHE_TTL` | `86400` | KV 缓存过期时间 (秒) |
| `KV_MAX_SIZE` | `20MB` | KV 最大缓存文件大小 |
| `ENABLE_CF_CACHE` | `true` | 是否启用 Cache API |
| `CF_CACHE_TTL` | `3600` | Cache API 缓存时间 (秒) |

## Python 版本

也支持 Python/Flask 部署，详见 `app/main.py`。

```bash
docker run -d --name="gh-proxy-py" \
  -p 0.0.0.0:80:80 \
  --restart=always \
  hunsh/gh-proxy-py:latest
```

## Cloudflare Workers 计费

免费版每天 10万次请求，每分钟 1000次限制。如需更多可升级 $5/月高级版 (1000万次/月)。

## 链接

- [作者博客](https://hunsh.net)
- [jsproxy](https://github.com/EtherDream/jsproxy/)

## License

MIT
