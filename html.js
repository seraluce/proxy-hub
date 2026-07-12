const INDEX_HTML = `<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitHub 资源加速 - GH Proxy</title>
    <meta name="description" content="GitHub Release、Archive 及项目文件的加速下载服务，基于 Cloudflare Workers">
    <meta name="theme-color" content="#0070f3">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230070f3' stroke-width='2'><polyline points='16 18 22 12 16 6'/><polyline points='8 6 2 12 8 18'/></svg>">
    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
    <style>
        :root {
            --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
            --font-mono: 'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace;
            --bg: #ffffff;
            --bg-secondary: #fafafa;
            --bg-tertiary: #f0f0f0;
            --bg-code: #f5f5f5;
            --fg: #000000;
            --fg-secondary: #666666;
            --fg-tertiary: #999999;
            --border: #eaeaea;
            --border-hover: #d0d0d0;
            --accent: #0070f3;
            --accent-hover: #0060df;
            --accent-foreground: #ffffff;
            --accent-light: rgba(0, 112, 243, 0.08);
            --success: #0ea5e9;
            --warning: #f59e0b;
            --error: #ef4444;
            --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
            --shadow: 0 4px 12px rgba(0,0,0,0.06);
            --shadow-lg: 0 12px 40px rgba(0,0,0,0.08);
            --radius: 8px;
            --radius-lg: 12px;
            --transition: 0.2s ease;
            --transition-slow: 0.35s ease;
        }
        [data-theme="dark"] {
            --bg: #0a0a0a;
            --bg-secondary: #111111;
            --bg-tertiary: #1a1a1a;
            --bg-code: #161616;
            --fg: #ededed;
            --fg-secondary: #888888;
            --fg-tertiary: #555555;
            --border: #2a2a2a;
            --border-hover: #444444;
            --accent: #3291ff;
            --accent-hover: #5aabff;
            --accent-foreground: #000000;
            --accent-light: rgba(50, 145, 255, 0.1);
            --success: #38bdf8;
            --warning: #fbbf24;
            --error: #f87171;
            --shadow-sm: 0 1px 2px rgba(0,0,0,0.2);
            --shadow: 0 4px 12px rgba(0,0,0,0.3);
            --shadow-lg: 0 12px 40px rgba(0,0,0,0.4);
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body {
            font-family: var(--font-sans);
            background: var(--bg);
            color: var(--fg);
            transition: background var(--transition-slow), color var(--transition-slow);
            line-height: 1.6;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        ::selection { background: var(--accent); color: var(--accent-foreground); }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--border-hover); }

        /* ===== 导航栏 ===== */
        .navbar {
            display: flex; align-items: center;
            width: 100%;
            height: 56px;
            border-bottom: 1px solid var(--border);
            background: color-mix(in srgb, var(--bg) 80%, transparent);
            backdrop-filter: blur(12px) saturate(180%);
            -webkit-backdrop-filter: blur(12px) saturate(180%);
            position: sticky; top: 0; z-index: 100;
            transition: background var(--transition), border-color var(--transition);
        }
        .nav-container {
            display: flex; align-items: center; justify-content: space-between;
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
        }
        @media (min-width: 1280px) {
            .nav-container { padding: 0 24px; }
        }
        @media (max-width: 640px) {
            .nav-container { padding: 0 12px; }
        }
.nav-brand { flex:1;
    display: flex; align-items: center; gap: 10px;
    font-weight: 700; font-size: 16px; letter-spacing: -0.02em;
    color: var(--fg); text-decoration: none;
    order: 1;
}
        .nav-brand svg { width: 20px; height: 20px; }
        .nav-links {
            display: flex; align-items: center; gap: 8px; list-style: none; font-size: 13px;
            order: 2;
        }
        .nav-links a {
            color: var(--fg-secondary); text-decoration: none; padding: 6px 12px;
            border-radius: 6px; transition: all var(--transition);
            display: flex; align-items: center; gap: 5px;
        }
        .nav-links a:hover { color: var(--fg); background: var(--accent-light); }
        .nav-links a svg { width: 14px; height: 14px; display: none; }
        /* 移动端菜单切换按钮 */
        #menuToggle { display: none;
    order: 4;
}
        .nav-actions { display: flex; align-items: center; gap: 8px;
    order: 2;
}
        .nav-actions .icon-btn:last-child { margin-left: 8px; }
        @media (max-width: 640px) {
            #menuToggle { display: flex; order: 1; }
            .nav-actions { order: 3; }
            .nav-actions .icon-btn:last-child { margin-left: 12px; }
            .nav-links { display: none; order: 4; }
            .navbar { z-index: 1001; }
            .nav-links.mobile-open {
                display: flex;
                flex-direction: column;
                background: var(--bg-secondary);
                position: absolute;
                top: 100%;
                right: 0;
                left: 0;
                margin: 4px 6px 0;
                border-radius: var(--radius);
                border: 1px solid var(--border);
                padding: 6px 4px;
                z-index: 1002;
                backdrop-filter: blur(12px) saturate(180%);
                -webkit-backdrop-filter: blur(12px) saturate(180%);
                box-shadow: var(--shadow-lg);
            }
            .nav-links.mobile-open li {
                width: 100%;
                margin: 1px 0;
            }
            .nav-links.mobile-open li a {
                justify-content: center;
                padding: 10px 12px;
                width: 100%;
                display: flex;
                align-items: center;
                gap: 10px;
                border-radius: 6px;
                font-size: 14px;
            }
            .nav-links.mobile-open li a svg {
                display: inline-block;
                width: 20px;
                height: 20px;
                margin-right: 8px;
            }
            .nav-links.mobile-open .nav-divider {
                height: 1px;
                background: var(--border);
                margin: 6px 12px;
            }
        }
        .mobile-overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            z-index: 90;
            pointer-events: auto;
        }
        .mobile-overlay.show {
            display: block;
        }
        .nav-actions { display: flex; align-items: center; gap: 8px;
    order: 3;
}
        .icon-btn {
            background: transparent; border: 1px solid var(--border); border-radius: 6px;
            padding: 7px 8px; cursor: pointer; color: var(--fg-secondary);
            transition: all var(--transition); display: flex; align-items: center; justify-content: center;
        }
        .icon-btn:hover { background: var(--bg-tertiary); color: var(--fg); border-color: var(--border-hover); }
        .icon-btn svg { width: 16px; height: 16px; }

        /* ===== 主容器 ===== */
        .container {
            max-width: 1200px; margin: 0 auto; padding: 48px 32px 64px;
            flex: 1; width: 100%;
        }
        .hero { text-align: center; margin-bottom: 40px; }
        .hero-badge {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 4px 12px; border-radius: 20px;
            background: var(--accent-light); color: var(--accent);
            font-size: 12px; font-weight: 600; letter-spacing: 0.02em;
            margin-bottom: 16px; border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
        }
        .hero-badge .dot {
            width: 6px; height: 6px; border-radius: 50%;
            background: var(--accent); animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; } 50% { opacity: 0.4; }
        }
        .hero h1 {
            font-size: 36px; font-weight: 700; letter-spacing: -0.04em;
            line-height: 1.15; margin-bottom: 12px;
        }
        .hero p { color: var(--fg-secondary); font-size: 15px; max-width: 480px; margin: 0 auto; }

        .card {
            background: var(--bg-secondary); border: 1px solid var(--border);
            border-radius: var(--radius-lg); padding: 28px;
            box-shadow: var(--shadow);
            transition: background var(--transition), border-color var(--transition), box-shadow var(--transition);
            max-width: 800px; margin: 0 auto;
        }
        .card:focus-within { box-shadow: var(--shadow-lg); border-color: var(--border-hover); }

        /* ===== 输入区域 ===== */
        .input-group { margin-bottom: 20px; }
        .input-wrapper {
            position: relative; display: flex; gap: 8px;
        }
        .input-wrapper input {
            flex: 1; min-width: 0;
            padding: 14px 44px 14px 16px;
            font-family: var(--font-mono); font-size: 13px;
            background: var(--bg); color: var(--fg);
            border: 1px solid var(--border); border-radius: var(--radius);
            outline: none; transition: all var(--transition);
        }
        .input-wrapper input:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 3px var(--accent-light);
        }
        .input-wrapper input.error {
            border-color: var(--error);
            box-shadow: 0 0 0 3px rgba(239,68,68,0.15);
        }
        .input-wrapper input::placeholder { color: var(--fg-tertiary); }
        .input-icon {
            position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
            background: none; border: none; border-radius: 4px;
            width: 24px; height: 24px; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            color: var(--fg-tertiary); transition: all var(--transition);
        }
        .input-icon:hover { color: var(--fg); background: var(--bg-tertiary); }
        .input-icon svg { width: 16px; height: 16px; }
        .paste-icon { display: flex; }
        .clear-icon { display: none; }
        .input-wrapper input:not(:placeholder-shown) ~ .paste-icon { display: none; }
        .input-wrapper input:not(:placeholder-shown) ~ .clear-icon { display: flex; }

        .btn {
            display: inline-flex; align-items: center; justify-content: center; gap: 8px;
            padding: 0 20px; height: 42px;
            font-family: var(--font-sans); font-size: 13px; font-weight: 600;
            border: 1px solid var(--border); border-radius: 8px;
            background: var(--bg-tertiary); color: var(--fg);
            cursor: pointer; transition: all var(--transition);
            text-decoration: none; white-space: nowrap; user-select: none;
        }
        .btn:hover { 
            background: var(--border); 
            transform: translateY(-2px); 
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            border-color: var(--border-hover);
        }
        .btn:active { transform: translateY(0); }
        .btn svg { width: 16px; height: 16px; flex-shrink: 0; }
        .btn-primary {
            background: linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%);
            color: var(--accent-foreground); border-color: transparent;
            font-weight: 600; box-shadow: 0 2px 8px rgba(0, 112, 243, 0.3);
        }
        .btn-primary:hover { 
            background: linear-gradient(135deg, var(--accent-hover) 0%, var(--accent) 100%);
            box-shadow: 0 4px 16px rgba(0, 112, 243, 0.4);
            transform: translateY(-2px);
        }
        .btn-primary:active { transform: translateY(0); opacity: 0.95; }

        /* ===== 下载操作组 ===== */
        .actions {
            display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
        }
        @media (max-width: 640px) {
            .actions { grid-template-columns: repeat(3, 1fr); gap: 8px; }
        }
        .actions .btn { width: 100%; font-size: 11px; padding: 0 10px; height: 34px; }
        .download-action {
            grid-column: 1 / -1;
            margin-top: 8px;
        }
        .download-action .btn {
            width: 100%;
            background: var(--accent-light);
            border-color: var(--accent);
            color: var(--accent);
            font-weight: 600;
        }
        .download-action .btn:hover {
            background: var(--accent);
            color: var(--accent-foreground);
        }

        /* ===== 提示区 ===== */
        .hints {
            margin-top: 16px; padding: 14px 16px;
            background: var(--bg-code); border-radius: var(--radius);
            font-family: var(--font-mono); font-size: 12px; color: var(--fg-secondary);
            display: none; line-height: 1.8; word-break: break-all;
            border: 1px solid var(--border);
        }
        .hints.show { display: block; animation: slideDown 0.2s ease; }
        .hints code { color: var(--accent); }
        @keyframes slideDown {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* ===== 分割线 ===== */
        .divider {
            display: flex; align-items: center; gap: 12px;
            margin: 20px 0; font-size: 12px; color: var(--fg-tertiary);
        }
        .divider::before, .divider::after {
            content: ''; flex: 1; height: 1px; background: var(--border);
        }

        /* ===== 示例链接 ===== */
        .examples { margin-top: 0; }
        .examples-title {
            font-size: 12px; font-weight: 600; color: var(--fg-tertiary);
            text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px;
        }
        .example-item {
            display: flex; align-items: center; gap: 10px;
            padding: 10px 12px; border-radius: 6px;
            cursor: pointer; transition: all var(--transition);
            border: 1px solid transparent;
        }
        .example-item:hover {
            background: var(--accent-light); border-color: color-mix(in srgb, var(--accent) 15%, transparent);
        }
        .example-item .icon { color: var(--fg-tertiary); flex-shrink: 0; }
        .example-item .icon svg { width: 14px; height: 14px; }
        .example-item .text {
            font-family: var(--font-mono); font-size: 12px; color: var(--fg-secondary);
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
        }
        .example-item:hover .text { color: var(--fg); }
        .example-tag {
            font-size: 10px; padding: 2px 6px; border-radius: 4px;
            background: var(--bg-tertiary); color: var(--fg-tertiary); font-weight: 500;
            flex-shrink: 0;
        }

        /* ===== Toast 通知 ===== */
        .toast-container {
            position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
            z-index: 9999; display: flex; flex-direction: column-reverse; gap: 8px;
            pointer-events: none;
        }
        .toast {
            padding: 10px 20px; border-radius: var(--radius);
            font-size: 13px; font-weight: 500;
            color: #fff; pointer-events: auto;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            animation: toastIn 0.3s ease, toastOut 0.3s ease 2.5s forwards;
            white-space: nowrap;
        }
        .toast-success { background: #10b981; }
        .toast-error { 
            position: fixed;
            top: calc(50% - 100px);
            left: 50%;
            transform: translateX(-50%);
            background: rgba(239, 68, 68, 0.1);
            border: 2px dashed #dc2626;
            color: #dc2626;
            animation: toastErrorIn 0.3s ease, toastErrorOut 0.3s ease 2.5s forwards;
        }
        .toast-info { background: var(--accent); }
        @keyframes toastIn {
            from { opacity: 0; transform: translateY(12px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes toastOut {
            from { opacity: 1; transform: translateY(0) scale(1); }
            to { opacity: 0; transform: translateY(-8px) scale(0.95); }
        }
        @keyframes toastErrorIn {
            from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes toastErrorOut {
            from { opacity: 1; transform: translateX(-50%) translateY(0); }
            to { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        }

        /* ===== 页脚 ===== */
        .footer {
            text-align: center; padding: 20px 24px; font-size: 12px;
            color: var(--fg-tertiary); border-top: 1px solid var(--border);
            background: var(--bg-secondary); transition: all var(--transition);
        }
        .footer a { color: var(--fg-secondary); text-decoration: none; transition: color var(--transition); }
        .footer a:hover { color: var(--accent); }
        .footer-links { display: flex; justify-content: center; gap: 16px; margin-top: 6px; }

        /* ===== 拖拽提示 ===== */
        .drag-overlay {
            display: none; position: fixed; inset: 0;
            background: color-mix(in srgb, var(--bg) 85%, transparent);
            backdrop-filter: blur(4px);
            z-index: 90; align-items: center; justify-content: center;
        }
        .drag-overlay.show { display: flex; }
        .drag-overlay-inner {
            border: 2px dashed var(--accent); border-radius: var(--radius-lg);
            padding: 48px 64px; text-align: center;
            background: var(--accent-light);
        }
        .drag-overlay-inner svg { width: 40px; height: 40px; color: var(--accent); margin-bottom: 12px; }
        .drag-overlay-inner p { color: var(--fg); font-size: 16px; font-weight: 600; }

        /* ===== 提示区块 ===== */
        .tips-section {
            display: flex; flex-direction: column; gap: 12px;
        }
        .tip-item {
            display: flex; gap: 12px; padding: 12px;
            background: var(--bg); border-radius: var(--radius);
            border: 1px solid var(--border);
            transition: all var(--transition);
        }
        .tip-item:hover {
            border-color: var(--border-hover);
            box-shadow: var(--shadow-sm);
        }
        .tip-icon {
            font-size: 18px; flex-shrink: 0;
        }
        .tip-content {
            flex: 1; min-width: 0;
        }
        .tip-content strong {
            display: block; font-size: 13px; color: var(--fg);
            margin-bottom: 4px;
        }
        .tip-content code {
            display: block; font-family: var(--font-mono);
            font-size: 11px; color: var(--accent);
            background: var(--bg-code); padding: 6px 8px;
            border-radius: 4px; margin: 6px 0;
            word-break: break-all;
        }
        .tip-desc {
            font-size: 12px; color: var(--fg-secondary);
            line-height: 1.4;
        }

        /* ===== 健康检查 ===== */
        .health-section {
            display: flex; align-items: center; gap: 10px;
            padding: 12px 16px; background: var(--bg);
            border-radius: var(--radius);
            border: 1px solid var(--border);
            font-size: 13px;
        }
        .health-dot {
            width: 8px; height: 8px; border-radius: 50%;
            background: #9ca3af;
            transition: background var(--transition);
        }
        .health-dot.online { background: #22c55e; }
        .health-dot.offline { background: #ef4444; }
        .health-dot.checking { background: #f59e0b; animation: pulse 1s ease-in-out infinite; }
        .health-text {
            color: var(--fg); font-weight: 500;
        }
        .health-latency {
            margin-left: auto; font-size: 12px;
            color: var(--fg-tertiary); font-family: var(--font-mono);
        }
        .health-status-link {
            margin-left: auto; font-size: 12px;
            color: var(--fg-tertiary); text-decoration: none;
        }
        .health-status-link:hover {
            color: var(--accent);
            text-decoration: underline;
        }

        /* ===== 响应式 ===== */
        @media (max-width: 1280px) {
            .container { max-width: 960px; padding: 48px 24px 64px; }
            .navbar { padding: 0 24px; }
        }
@media (max-width: 640px) {
    .navbar { padding: 0 12px; }
    .nav-links { display: none; order: 4; }
    .container { padding: 16px 12px 24px; }
    .hero h1 { font-size: 26px; }
    .hero p { font-size: 13px; }
    .card { padding: 12px; }
    .input-wrapper { flex-direction: column; }
    .btn { width: 100%; max-width: 240px; margin: 0 auto 10px; height: 52px; font-size: 15px; }
    .actions { grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .actions .btn { width: 100%; max-width: none; margin: 0 auto; height: 40px; font-size: 12px; }
    .download-action { grid-column: 1 / -1; }
    .download-action .btn { width: 100%; max-width: none; height: 44px; font-size: 13px; }
    .nav-actions { order: 2; }
    #menuToggle { order: 3; }
}
        @media (max-width: 480px) {
            .hero { margin-bottom: 28px; }
            .hero h1 { font-size: 24px; }
        }
        .sr-only {
            position: absolute; width: 1px; height: 1px; padding: 0;
            margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0;
        }
    </style>
</head>
<body>

<!-- 导航栏 -->
<nav class="navbar" role="navigation" aria-label="主导航">
    <div class="nav-container">
    <a href="/" class="nav-brand">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
    </svg>
    <span>GH Proxy</span>
</a>
    <div class="nav-actions">
        <button class="icon-btn" id="menuToggle" aria-label="切换菜单" title="菜单">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
        </button>
        <button class="icon-btn" id="themeToggle" aria-label="切换主题" title="切换深色/浅色模式">
            <svg id="sunIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
            <svg id="moonIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="display:none">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
        </button>
    </div>
    <div class="nav-menu">
        <ul class="nav-links" id="navLinks">
            <li><a href="https://github.com" target="_blank" rel="noopener">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
                GitHub
            </a></li>
            <li class="nav-divider"></li>
            <li><a href="https://github.com/hunshcn/gh-proxy" target="_blank" rel="noopener">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4v16h16"/><polyline points="20 10 12 18 8 14"/></svg>
                SOURCE
            </a></li>
        </ul>
    </div>
    </div>
</nav>

<!-- 主内容 -->
<main class="container">
    <div class="hero">
        <div class="hero-badge"><span class="dot"></span>Cloudflare Workers 加速</div>
        <h1>GitHub 资源加速</h1>
        <p>输入 GitHub 链接，通过 Cloudflare 边缘节点加速下载 Release、源码和文件</p>
    </div>

    <div class="card">
        <div class="input-group">
            <div class="input-wrapper">
                <input type="url" id="inputUrl" placeholder="粘贴 GitHub 链接..." autofocus spellcheck="false" autocomplete="off">
                <button class="input-icon paste-icon" id="pasteBtn" title="粘贴链接">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/><line x1="9" y1="12" x2="18" y2="12"/><line x1="9" y1="16" x2="18" y2="16"/></svg>
                </button>
                <button class="input-icon clear-icon" id="clearBtn" title="清空">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        </div>
        <div class="input-wrapper" style="margin-bottom:12px">
            <button class="btn btn-primary" id="downloadBtn" style="flex:1">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                直接下载
            </button>
        </div>
        <div class="actions">
            <button class="btn" id="aria2Btn" title="最快: 多线程下载命令 (推荐)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                aria2 (最快)
            </button>
            <button class="btn" id="wgetBtn" title="复制 wget 下载命令">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>
                wget
            </button>
            <button class="btn" id="curlBtn" title="复制 curl 下载命令">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>
                curl
            </button>
        </div>
        <div class="hints" id="hints"></div>

        <div class="divider">示例</div>

        <div class="examples">
            <div class="example-item" data-url="https://github.com/hunshcn/gh-proxy/releases/download/v0.1.0/example.zip">
                <span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span>
                <span class="text">github.com/.../releases/download/v1.0/file.zip</span>
                <span class="example-tag">Release</span>
            </div>
            <div class="example-item" data-url="https://github.com/facebook/react/archive/refs/heads/main.zip">
                <span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span>
                <span class="text">github.com/.../archive/refs/heads/main.zip</span>
                <span class="example-tag">Archive</span>
            </div>
            <div class="example-item" data-url="https://github.com/vercel/next.js/blob/canary/package.json">
                <span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg></span>
                <span class="text">github.com/.../blob/main/package.json</span>
                <span class="example-tag">Code → jsDelivr</span>
            </div>
            <div class="example-item" data-url="https://raw.githubusercontent.com/nodejs/node/main/README.md">
                <span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span>
                <span class="text">raw.githubusercontent.com/.../README.md</span>
                <span class="example-tag">Raw → jsDelivr</span>
            </div>
        </div>

        <div class="divider">加速提示</div>

        <div class="tips-section">
            <div class="tip-item">
                <span class="tip-icon">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                </span>
                <div class="tip-content">
                    <strong>aria2 多线程下载 (推荐)</strong>
                    <code>aria2c -x 16 -s 16 -k 1M -o 文件名 "加速链接"</code>
                    <span class="tip-desc">16线程并行下载，速度可达单线程 10 倍以上</span>
                </div>
            </div>
            <div class="tip-item">
                <span class="tip-icon">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                </span>
                <div class="tip-content">
                    <strong>断点续传</strong>
                    <code>wget -c "加速链接" 或 aria2c -c "加速链接"</code>
                    <span class="tip-desc">网络中断后可从断点继续，无需重新下载</span>
                </div>
            </div>
            <div class="tip-item">
                <span class="tip-icon">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                </span>
                <div class="tip-content">
                    <strong>URL 直接加速</strong>
                    在任意 GitHub 链接前加上当前域名即可
                    <span class="tip-desc">支持 Release、Archive、Raw 文件、Gist</span>
                </div>
            </div>
        </div>

<div class="divider">GitHub 连通性</div>
        <div class="health-section" id="healthSection">
            <span class="health-dot checking" id="healthDot" title="GitHub 连接状态：绿色=正常，黄色=检测中，红色=异常"></span>
            <span class="health-text" id="healthText">检测中...</span>
            <span class="health-latency" id="healthLatency"></span>
            <a href="https://www.githubstatus.com/" target="_blank" rel="noopener" class="health-status-link" title="查看 GitHub 官方状态页面">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 6px; opacity: 0.7;">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
            </a>
        </div>
    </div>
</main>

<!-- 页脚 -->
<footer class="footer">
    <div>基于 Cloudflare Workers 构建 - 免费、开源、无服务器</div>
    <div class="footer-links">
        <a href="https://github.com/hunshcn/gh-proxy" target="_blank" rel="noopener">GitHub</a>
        <a href="https://workers.cloudflare.com" target="_blank" rel="noopener">Cloudflare Workers</a>
        <a href="https://github.com/hunshcn/gh-proxy/blob/master/LICENSE" target="_blank" rel="noopener">MIT License</a>
    </div>
</footer>

<div class="mobile-overlay" id="mobileOverlay"></div>
<!-- 拖拽提示 -->
<div class="drag-overlay" id="dragOverlay">
    <div class="drag-overlay-inner">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p>释放以粘贴链接</p>
    </div>
</div>
<script src="https://giscus.app/client.js"
        data-repo="seraluce/gh-proxy"
        data-repo-id="R_kgDOTV_VtQ"
        data-category="Announcements"
        data-category-id="DIC_kwDOTV_Vtc4DBCSb"
        data-mapping="pathname"
        data-strict="0"
        data-reactions-enabled="1"
        data-emit-metadata="0"
        data-input-position="bottom"
        data-theme="preferred_color_scheme"
        data-lang="zh-CN"
        crossorigin="anonymous"
        async>
</script>
<!-- Toast 容器 -->
<div class="toast-container" id="toastContainer"></div>

<script>
(function() {
    'use strict';

    // ===== DOM =====
    const $ = s => document.querySelector(s);
    const input = $('#inputUrl');
    const wgetBtn = $('#wgetBtn');
    const curlBtn = $('#curlBtn');
    const downloadBtn = $('#downloadBtn');
    const hintsEl = $('#hints');
    const pasteBtn = $('#pasteBtn');
    const clearBtn = $('#clearBtn');
    const themeToggle = $('#themeToggle');
    const sunIcon = $('#sunIcon');
    const moonIcon = $('#moonIcon');
    const dragOverlay = $('#dragOverlay');
    const toastContainer = $('#toastContainer');
    const menuToggle = $('#menuToggle');
    const navLinks = $('#navLinks');
    const mobileOverlay = $('#mobileOverlay');

    // ===== 工具函数 =====
    function getBaseUrl() { return location.origin + '/'; }

    function buildProxyUrl(raw) {
        raw = raw.trim();
        if (!raw) return null;
        if (raw.startsWith(getBaseUrl())) return raw;
        if (/^https?:\\/\\//.test(raw)) return getBaseUrl() + raw;
        if (/^github\\.com\\//.test(raw) || /^raw\\.githubusercontent\\.com\\//.test(raw)) return getBaseUrl() + 'https://' + raw;
        return getBaseUrl() + 'https://' + raw;
    }

    function isValidGitHubUrl(url) {
        return /github\\.com|githubusercontent\\.com/i.test(url);
    }

    function extractFilename(url) {
        try {
            const parts = url.split('/');
            return parts[parts.length - 1] || 'download';
        } catch { return 'download'; }
    }

    // ===== Toast =====
    function toast(msg, type = 'info') {
        if (type === 'error') {
            // 对于错误消息，创建居中的弹窗
            const el = document.createElement('div');
            el.className = 'toast toast-error';
            el.textContent = msg;
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 3000);
        } else {
            // 对于其他类型的消息，使用容器
            const el = document.createElement('div');
            el.className = 'toast toast-' + type;
            el.textContent = msg;
            toastContainer.appendChild(el);
            setTimeout(() => el.remove(), 3000);
        }
    }

    // ===== 复制 =====
    async function copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            toast('已复制到剪贴板', 'success');
            return true;
        } catch {
            // fallback
            const ta = document.createElement('textarea');
            ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
            document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); toast('已复制到剪贴板', 'success'); }
            catch { toast('复制失败', 'error'); }
            ta.remove();
            return false;
        }
    }

    // ===== 主题 =====
    function initTheme() {
        const saved = localStorage.getItem('gh-proxy-theme');
        if (saved === 'dark' || (!saved && matchMedia('(prefers-color-scheme:dark)').matches)) {
            setTheme('dark');
        } else {
            setTheme('light');
        }
    }
    function setTheme(t) {
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('gh-proxy-theme', t);
        if (t === 'dark') {
            sunIcon.style.display = 'none';
            moonIcon.style.display = '';
        } else {
            sunIcon.style.display = '';
            moonIcon.style.display = 'none';
        }
    }
    function toggleTheme() {
        const cur = document.documentElement.getAttribute('data-theme');
        setTheme(cur === 'dark' ? 'light' : 'dark');
    }

    // ===== 输入处理 =====
    function updateHints() {
        const raw = input.value.trim();
        if (!raw || !isValidGitHubUrl(raw)) {
            hintsEl.classList.remove('show');
            return;
        }
        const proxy = buildProxyUrl(raw);
        hintsEl.innerHTML =
            '<strong>加速链接</strong><br><code>' + escHtml(proxy) + '</code>';
        hintsEl.classList.add('show');
    }

    function escHtml(s) {
        return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function showInputError() {
        input.focus();
        input.classList.add('error');
        setTimeout(() => input.classList.remove('error'), 1500);
    }

    function handleWget() {
        const raw = input.value.trim();
        if (!raw || !isValidGitHubUrl(raw)) { toast('请先输入 GitHub 链接', 'error'); showInputError(); return; }
        const url = buildProxyUrl(raw);
        const fn = extractFilename(raw);
        copyText('wget -O ' + fn + ' "' + url + '"');
    }

    function handleCurl() {
        const raw = input.value.trim();
        if (!raw || !isValidGitHubUrl(raw)) { toast('请先输入 GitHub 链接', 'error'); showInputError(); return; }
        const url = buildProxyUrl(raw);
        const fn = extractFilename(raw);
        copyText('curl -L -o ' + fn + ' "' + url + '"');
    }

    function handleDownload() {
        const raw = input.value.trim();
        if (!raw || !isValidGitHubUrl(raw)) { toast('请先输入 GitHub 链接', 'error'); showInputError(); return; }
        const url = buildProxyUrl(raw);
        window.open(url, '_blank');
    }

    // ===== 事件绑定 =====
    input.addEventListener('input', updateHints);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') handleDownload(); });
    pasteBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                input.value = text;
                updateHints();
                input.focus();
            }
        } catch {
            toast('无法读取剪贴板', 'error');
        }
    });
    clearBtn.addEventListener('click', () => { input.value = ''; updateHints(); input.focus(); });
    wgetBtn.addEventListener('click', handleWget);
    curlBtn.addEventListener('click', handleCurl);
    downloadBtn.addEventListener('click', handleDownload);
    themeToggle.addEventListener('click', toggleTheme);
    menuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('mobile-open');
        mobileOverlay.classList.toggle('show');
    });
    
    mobileOverlay.addEventListener('click', () => {
        navLinks.classList.remove('mobile-open');
        mobileOverlay.classList.remove('show');
    });

    // 示例点击
    document.querySelectorAll('.example-item').forEach(el => {
        el.addEventListener('click', () => {
            input.value = el.dataset.url;
            updateHints();
            input.focus();
            input.select();
        });
    });

    // 拖拽 URL
    let dragCounter = 0;
    document.addEventListener('dragenter', e => {
        e.preventDefault();
        dragCounter++;
        if (e.dataTransfer.types.includes('text/plain')) dragOverlay.classList.add('show');
    });
    document.addEventListener('dragleave', () => {
        dragCounter--;
        if (dragCounter <= 0) { dragCounter = 0; dragOverlay.classList.remove('show'); }
    });
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => {
        e.preventDefault();
        dragCounter = 0;
        dragOverlay.classList.remove('show');
        const text = (e.dataTransfer.getData('text/plain') || '').trim();
        if (text && isValidGitHubUrl(text)) {
            input.value = text;
            updateHints();
            toast('已粘贴链接', 'info');
        }
    });

    // 粘贴事件
    input.addEventListener('paste', e => {
        setTimeout(updateHints, 50);
    });

    // ===== 初始化 =====
    initTheme();
    updateHints();

    // 自动填充 URL 参数
    const params = new URLSearchParams(location.search);
    if (params.has('q')) {
        input.value = params.get('q');
        updateHints();
    }

    // ===== 健康检查 =====
    async function checkHealth() {
        const healthDot = $('#healthDot');
        const healthText = $('#healthText');
        const healthLatency = $('#healthLatency');
        
        if (!healthDot || !healthText || !healthLatency) return;
        
        try {
            healthDot.className = 'health-dot checking';
            healthText.textContent = '检测中...';
            healthLatency.textContent = '';
            
            const start = Date.now();
            const resp = await fetch('/health', {
                method: 'GET',
                cache: 'no-store'
            });
            const latency = Date.now() - start;
            
            if (resp.ok) {
                const data = await resp.json();
                if (data.github === 'reachable') {
                    healthDot.className = 'health-dot online';
                    healthText.textContent = 'GitHub 连接正常';
                    healthLatency.textContent = data.latency_ms + 'ms';
                } else {
                    healthDot.className = 'health-dot offline';
                    healthText.textContent = 'GitHub 连接异常';
                    healthLatency.textContent = '错误';
                }
            } else {
                healthDot.className = 'health-dot offline';
                healthText.textContent = '检测失败';
                healthLatency.textContent = resp.status;
            }
        } catch (err) {
            healthDot.className = 'health-dot offline';
            healthText.textContent = '检测失败';
            healthLatency.textContent = '网络错误';
        }
    }
    
    // 页面加载时检测健康状态
    setTimeout(checkHealth, 1000);
    
    // 每30秒重新检测
    setInterval(checkHealth, 30000);
})();
</script>

</body>
</html>`;

export default INDEX_HTML
