/**
 * Cloudflare Worker - 尊享极速扫码开单助手 (完美解决国内扫码卡死问题)
 * 
 * 部署指引：
 * 1. 登录 Cloudflare 控制台 (dash.cloudflare.com)
 * 2. 进入 「Workers 和 Pages」 -> 点击 「创建」 -> 选择 「创建 Worker」
 * 3. 命名为 `daijia-helper` 
 * 4. 关键：点击「从 Hello World! 开始」 (或者「创建并部署」默认模板)
 * 5. 部署完默认模板后，点击 「编辑代码」 (Edit Code)
 * 6. 将本文件的全部代码复制粘贴覆盖进去，点击右上角的 「保存并部署」 (Save and Deploy)
 * 7. 绑定您自己的自定义域名 `daijiajifei.ccwu.cc`
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 允许跨域请求 (CORS preflight)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    // 接口路由：提交表单数据，后台代写入 Firebase
    if (request.method === "POST" && url.pathname === "/api/submit") {
      return await handleOrderSubmit(request);
    }

    // 页面路由：渲染极致流畅、不卡顿的前端乘客填单界面
    const driverPhone = url.searchParams.get("driver") || "18609518888";
    return new Response(getHTMLTemplate(driverPhone), {
      headers: { 
        "Content-Type": "text/html;charset=UTF-8",
        "Access-Control-Allow-Origin": "*" 
      },
    });
  }
};

/**
 * 云端中继写入 Firestore，彻底解决国内网络无法直接连接 Google 数据库的通病
 */
async function handleOrderSubmit(request) {
  try {
    const payload = await request.json();
    const { driverPhone, passengerPhone, startLocation, destination } = payload;

    if (!driverPhone || !passengerPhone || !startLocation) {
      return new Response(JSON.stringify({ success: false, error: "缺少必填参数" }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json", 
          "Access-Control-Allow-Origin": "*" 
        },
      });
    }

    // 配置实时远程高可用沙箱数据库凭证
    const projectId = "autonomous-abbey-nnzsc";
    const databaseId = "ai-studio-8c2c2304-5251-4eae-b3b7-9bbf375467a5";
    const apiKey = "AIzaSyD1VHQ2AL0NklJCJCjy4EFqIs2HrqMy4RQ";
    const collectionId = "passenger_links";

    // 使用 Firestore PATCH API 实现自动创建/彻底覆盖写入，通知司机端实时快照
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${collectionId}/${encodeURIComponent(driverPhone)}?updateMask.fieldPaths=passengerPhone&updateMask.fieldPaths=startLocation&updateMask.fieldPaths=destination&updateMask.fieldPaths=status&updateMask.fieldPaths=timestamp&key=${apiKey}`;

    const timestamp = Date.now();

    const firestoreBody = {
      fields: {
        passengerPhone: { stringValue: passengerPhone.trim() },
        startLocation: { stringValue: startLocation.trim() },
        destination: { stringValue: (destination || "").trim() },
        status: { stringValue: "submitted" },
        timestamp: { doubleValue: timestamp }
      }
    };

    const response = await fetch(firestoreUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(firestoreBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ success: false, error: "云端开单对接失败，请稍后重试", detail: errorText }), {
        status: response.status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    return new Response(JSON.stringify({ success: true, timestamp }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
}

/**
 * 极致优化前端 HTML 模板
 * 1. 移除了任何谷歌或国外 CDN 阻塞脚本
 * 2. 交互与布局进行极致优雅重构（科技悬浮黑 + 高级翡翠绿）
 * 3. 提交秒级触达，司机端听到语音播报并同步跳转
 */
function getHTMLTemplate(driverPhone) {
  const maskedPhone = driverPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>扫码授权自助开单助推手</title>
  <!-- 高速无阻塞加载国内合规前端样式流 -->
  <script src="https://cdn.staticfile.org/tailwindcss/2.2.19/tailwind.min.js"></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans CJK SC", sans-serif;
      background-color: #05070c;
    }
    input:focus {
      outline: none;
      box-shadow: 0 0 0 2px rgba(20, 184, 166, 0.2);
    }
    /* 自定义呼吸微光 */
    @keyframes subtlePulse {
      0%, 100% { opacity: 0.8; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.05); }
    }
    .pulse-glow {
      animation: subtlePulse 2.5s infinite ease-in-out;
    }
  </style>
</head>
<body class="text-gray-100 min-h-screen flex flex-col justify-between antialiased pb-safe">

  <!-- 科技感尊贵顶部状态栏 -->
  <header class="bg-gradient-to-b from-teal-950/80 to-[#070b14] px-6 py-5 border-b border-teal-500/10 relative overflow-hidden shrink-0">
    <!-- 右上角环形渐变光效 -->
    <div class="absolute -right-12 -top-12 w-28 h-28 rounded-full bg-teal-400 opacity-10 blur-xl"></div>
    
    <div class="relative z-10 flex flex-col space-y-1.5 text-left">
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-lg shadow-emerald-400/50"></span>
        <span class="text-[10px] font-bold tracking-widest uppercase text-teal-400">
          极速自助呼叫 • 极速专线（乘客端）
        </span>
      </div>
      <h1 class="text-xl font-bold text-white tracking-tight">扫码极速授权自助填单</h1>
      <p class="text-xs text-teal-200/80 leading-normal">
        当前连线至司机 <span class="font-mono font-extrabold text-teal-300 bg-teal-900/40 px-2 py-0.5 rounded border border-teal-800/50 ml-0.5">${maskedPhone}</span>
      </p>
    </div>
  </header>

  <!-- 主交互操作面板 -->
  <main class="flex-1 px-5 py-6 flex flex-col justify-center max-w-md mx-auto w-full">
    
    <!-- 面板1: 表单录入容器 -->
    <div id="form-container" class="space-y-5">
      
      <!-- 安全锁防护卡片 -->
      <div class="bg-gradient-to-r from-teal-950/20 to-slate-900/30 rounded-2xl p-4 border border-teal-500/15 flex gap-3 text-xs leading-normal">
        <!-- 安全保险箱图标 -->
        <svg class="w-6 h-6 text-teal-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
        </svg>
        <div>
          <p class="font-bold text-teal-300 mb-0.5 flex items-center gap-1">扫码防丢与链路自动授权</p>
          <p class="text-[11px] text-gray-400 leading-relaxed">
            请在此核对开单乘客的信息。完成确认后，司机端将<b>立即同步跳转并开始语音播报</b>，为您安全创单。
          </p>
        </div>
      </div>

      <!-- 实打实快捷填单表 -->
      <form id="order-form" class="space-y-4">
        <!-- 乘客电话输入 -->
        <div class="space-y-1.5 text-left">
          <label class="text-[11px] font-bold text-gray-400 uppercase tracking-widest block">
            📞 您的手机号码 (必填)
          </label>
          <div class="relative flex items-center bg-[#090d19] border border-gray-800 focus-within:border-teal-400 rounded-xl px-4 py-3.5 transition-all">
            <span class="text-xl mr-2.5 shrink-0 select-none">📱</span>
            <input
              type="tel"
              id="passenger-phone"
              required
              maxlength="11"
              autocomplete="tel"
              placeholder="请输入乘客本人的11位手机号"
              class="bg-transparent border-none w-full text-white text-base font-bold placeholder-gray-600 outline-none focus:ring-0"
              style="outline: none;"
            />
          </div>
        </div>

        <!-- 出发地输入 -->
        <div class="space-y-1.5 text-left">
          <label class="text-[11px] font-bold text-gray-400 uppercase tracking-widest block">
            📍 您所在的位置 (出发地)
          </label>
          <div class="relative flex items-center bg-[#090d19] border border-gray-800 focus-within:border-teal-400 rounded-xl px-4 py-3.5 transition-all">
            <span class="text-xl mr-2.5 shrink-0 select-none">📍</span>
            <input
              type="text"
              id="start-location"
              required
              value="万达广场写字楼A座"
              placeholder="请核对当前上车并出发的地点"
              class="bg-transparent border-none w-full text-white text-base font-bold placeholder-gray-600 outline-none focus:ring-0"
              style="outline: none;"
            />
          </div>
        </div>

        <!-- 目的地输入（选填） -->
        <div class="space-y-1.5 text-left">
          <label class="text-[11px] font-bold text-gray-400 uppercase tracking-widest block">
            🏁 去往的目的地 (选填)
          </label>
          <div class="relative flex items-center bg-[#090d19] border border-gray-800 focus-within:border-teal-400 rounded-xl px-4 py-3.5 transition-all">
            <span class="text-xl mr-2.5 shrink-0 select-none">🏁</span>
            <input
              type="text"
              id="destination"
              placeholder="请输入您此行的目的地(可选)"
              class="bg-transparent border-none w-full text-white text-base font-bold placeholder-gray-600 outline-none focus:ring-0"
              style="outline: none;"
            />
          </div>
        </div>

        <!-- 服务商与协议选择 -->
        <div class="pt-2 flex items-start gap-2.5 text-[10px] text-gray-500 leading-relaxed text-left">
          <input
            type="checkbox"
            required
            checked
            id="agreement"
            class="mt-1 w-4 h-4 text-teal-500 bg-gray-900 border-gray-850 rounded focus:ring-teal-500 accent-teal-500 cursor-pointer"
          />
          <label for="agreement" class="cursor-pointer select-none">
            安全协议已生效。您的车牌状态及行程信息将被实时同步上传至司机与后台，并一键确认授权发起此趟尊享代驾代开单流程。
          </label>
        </div>

        <!-- 超赞高质闪耀提交键 -->
        <button
          type="submit"
          id="submit-btn"
          class="w-full py-4 mt-3 rounded-xl text-center font-bold text-base inline-flex items-center justify-center gap-2 active:scale-95 duration-150 cursor-pointer text-white bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 shadow-lg shadow-teal-500/20 font-sans"
        >
          <span>🚀 确认授权并通知司机开单</span>
        </button>
      </form>
    </div>

    <!-- 面板2: 开单跳转并成功展示界面 (点击确认后呈现) -->
    <div id="success-container" class="hidden space-y-6 py-6 px-4 text-center animate-pulse">
      
      <!-- 极光绿高贵对勾图案 -->
      <div class="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 pulse-glow">
        <svg class="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path>
        </svg>
      </div>

      <div class="space-y-2">
        <h2 class="text-xl font-bold text-white tracking-wide">🎉 授权成功！系统已播报开单</h2>
        <p class="text-xs text-gray-400 leading-relaxed px-2">
          您的填单已经投递成功。司机软件将立即发生<span class="text-emerald-400 font-bold ml-1 mr-1">弹窗跳转以及语音报单</span>！
        </p>
        
        <!-- 交易车单复古票据卡 -->
        <div class="bg-gradient-to-b from-[#0f1422] to-[#0a0d17] p-5 rounded-2xl border border-teal-500/10 space-y-3 text-left mt-5 text-sm">
          <div class="flex items-center justify-between pb-2 border-b border-gray-800/80">
            <span class="text-xs text-teal-400 font-bold">📋 尊享行程开单凭证</span>
            <span class="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">实时同步中</span>
          </div>
          <div class="space-y-2 text-gray-400 text-xs">
            <p class="flex justify-between">
              <span>出发上车点：</span>
              <span id="summary-start" class="text-gray-100 font-bold">...</span>
            </p>
            <p id="summary-dest-wrapper" class="flex justify-between">
              <span>去往目的地：</span>
              <span id="summary-dest" class="text-gray-100 font-bold">...</span>
            </p>
            <p class="flex justify-between">
              <span>乘客手机号：</span>
              <span id="summary-phone" class="text-teal-300 font-bold font-mono">...</span>
            </p>
            <p class="flex justify-between">
              <span>同步司机号码：</span>
              <span class="text-gray-100 font-mono font-bold">${maskedPhone}</span>
            </p>
          </div>
        </div>
      </div>

      <p class="text-[10px] text-gray-600 font-medium tracking-wide">
        请坐进车内，司机接收到您的填单后，可在软件端一键点选开单计费
      </p>
    </div>

  </main>

  <!-- 安全托管标志底栏 -->
  <footer class="p-5 text-center text-[9px] text-gray-700 font-medium tracking-wider border-t border-gray-900/60 shrink-0 font-mono">
    SECURE CHAUFFEUR CONNECT SYSTEM • CLOUDFLARE SSL PROXIED
  </footer>

  <script>
    const form = document.getElementById('order-form');
    const submitBtn = document.getElementById('submit-btn');
    const formContainer = document.getElementById('form-container');
    const successContainer = document.getElementById('success-container');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const passengerPhone = document.getElementById('passenger-phone').value.trim();
      const startLocation = document.getElementById('start-location').value.trim();
      const destination = document.getElementById('destination').value.trim();
      const driverPhone = "${driverPhone}";

      if (!passengerPhone) {
        alert('✍️ 提示：请输入您的手机号码！');
        return;
      }
      if (!/^1[3-9]\\d{9}$/.test(passengerPhone)) {
        alert('✍️ 提示：请核对并输入11位有效手机号码！');
        return;
      }

      // 置灰按钮防止重复提交，提供极佳体验
      submitBtn.disabled = true;
      submitBtn.className = "w-full py-4 mt-3 rounded-xl text-center font-bold text-base inline-flex items-center justify-center gap-2 bg-gray-800 text-gray-500 cursor-not-allowed";
      submitBtn.innerHTML = "⏳ 正在连接安全专线，请稍候...";

      try {
        const response = await fetch('/api/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            driverPhone,
            passengerPhone,
            startLocation,
            destination
          })
        });

        const result = await response.json();

        if (result.success) {
          // 渲染并保存本次开单的凭证至结果界面
          document.getElementById('summary-phone').innerText = passengerPhone.replace(/(\\d{3})\\d{4}(\\d{4})/, '$1****$2');
          document.getElementById('summary-start').innerText = startLocation;
          
          if (destination) {
            document.getElementById('summary-dest').innerText = destination;
          } else {
            document.getElementById('summary-dest-wrapper').style.display = 'none';
          }

          // 动效切换主操作面板
          formContainer.style.display = 'none';
          successContainer.classList.remove('hidden');
          successContainer.style.display = 'block';
        } else {
          alert('⚠️ 连线创建失败: ' + (result.error || '无法接入安全链路，请稍后刷新重试'));
          resetBtn();
        }
      } catch (err) {
        alert('⚠️ 网络异常，提交超时，请检查您的移动数据连接！\\n\\n提示: 如果您的 Cloudflare 已部署，可能是在域名和中介处理中，请重新尝试。');
        resetBtn();
      }
    });

    function resetBtn() {
      submitBtn.disabled = false;
      submitBtn.className = "w-full py-4 mt-3 rounded-xl text-center font-bold text-base inline-flex items-center justify-center gap-2 active:scale-95 duration-150 cursor-pointer text-white bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 shadow-lg shadow-teal-500/20";
      submitBtn.innerHTML = "🚀 确认授权并通知司机开单";
    }
  </script>
</body>
</html>`;
}
