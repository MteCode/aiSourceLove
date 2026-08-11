/**
 * 极简顶部进度条。
 *
 * 只为路由切换那一下的反馈，不值得为它引 nprogress 这个额外依赖，
 * 30 行 DOM 操作就够了。
 */
let bar: HTMLElement | null = null;
let timer: number | null = null;

function ensureBar(): HTMLElement {
  if (bar) return bar;
  bar = document.createElement('div');
  bar.className = 'yq-progress';
  document.body.appendChild(bar);
  return bar;
}

export default {
  start(): void {
    const el = ensureBar();
    if (timer) window.clearInterval(timer);
    el.style.opacity = '1';
    let width = 0;
    el.style.width = '0%';
    timer = window.setInterval(() => {
      // 越接近 90% 走得越慢，制造「还在加载」的观感
      width += (90 - width) * 0.1;
      el.style.width = `${width}%`;
    }, 120);
  },
  done(): void {
    const el = ensureBar();
    if (timer) window.clearInterval(timer);
    timer = null;
    el.style.width = '100%';
    window.setTimeout(() => {
      el.style.opacity = '0';
    }, 200);
  },
};
