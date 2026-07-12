// ============================================================
// 独立的 HTML 页面（含 CSS + JS）
// ============================================================

const INDEX_HTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitHub 代理加速</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-height:100vh;display:flex;justify-content:center;align-items:center;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:20px}
        .container{background:#fff;padding:40px;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.3);max-width:600px;width:100%}
        h1{color:#333;margin-bottom:8px;font-size:28px}
        .subtitle{color:#666;margin-bottom:30px;font-size:14px}
        .input-group{display:flex;gap:10px;margin-bottom:20px}
        input{flex:1;padding:12px 16px;border:2px solid #e0e0e0;border-radius:8px;font-size:14px;transition:border-color .3s}
        input:focus{outline:none;border-color:#667eea}
        button{padding:12px 24px;background:#667eea;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:transform .1s,background .3s}
        button:hover{background:#5a67d8}
        button:active{transform:scale(.95)}
        .examples{background:#f7f7f7;border-radius:8px;padding:16px;margin-top:20px}
        .examples p{color:#555;font-size:13px;margin-bottom:8px}
        .examples code{display:block;background:#e8e8e8;padding:6px 10px;border-radius:4px;margin:4px 0;font-size:12px;word-break:break-all;cursor:pointer}
        .examples code:hover{background:#ddd}
        .footer{margin-top:24px;text-align:center;color:#999;font-size:12px}
        .toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;border-radius:8px;font-size:14px;opacity:0;transition:opacity .3s;pointer-events:none}
        .toast.show{opacity:1}
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 GitHub 代理加速</h1>
        <p class="subtitle">输入 GitHub 链接，快速下载文件</p>
        <div class="input-group">
            <input id="input" placeholder="https://github.com/user/repo/releases/download/v1.0/file.zip" />
            <button id="btn">🚀 加速</button>
        </div>
        <div class="examples">
            <p>📌 支持以下类型：</p>
            <code>https://github.com/user/repo/releases/download/v1.0/file.zip</code>
            <code>https://github.com/user/repo/blob/main/file.js</code>
            <code>https://raw.githubusercontent.com/user/repo/main/file.txt</code>
        </div>
        <div class="footer">⚡ Cloudflare Workers 加速 · 开源免费</div>
    </div>
    <div id="toast" class="toast">✅ 已复制</div>
    <script>
        const input=document.getElementById('input'),btn=document.getElementById('btn'),toast=document.getElementById('toast');
        function buildUrl(original){
            const prefix=window.location.pathname.replace(/\\/+$/,'')||'';
            return window.location.origin+prefix+'/'+original;
        }
        btn.addEventListener('click',()=>{
            let url=input.value.trim();
            if(!url)return;
            if(!/^https?:\\/\\//i.test(url))url='https://'+url;
            window.open(buildUrl(url),'_blank');
        });
        input.addEventListener('keydown',e=>{if(e.key==='Enter')btn.click()});
        document.querySelectorAll('.examples code').forEach(el=>{
            el.addEventListener('click',()=>{
                input.value=el.textContent.trim();
                btn.click();
            });
        });
        input.focus();
    </script>
</body>
</html>`

export default INDEX_HTML