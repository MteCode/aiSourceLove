/** uni 的交互 API 都是回调式，包一层 Promise，页面里好写 */

export function toast(title: string, icon: 'none' | 'success' | 'error' = 'none'): void {
  uni.showToast({ title, icon, duration: 2000 });
}

export function loading(title = '加载中'): void {
  uni.showLoading({ title, mask: true });
}

export function hideLoading(): void {
  uni.hideLoading();
}

/** 确认框。取消返回 false，不抛异常——页面里 if 判断比 try/catch 干净 */
export function confirm(content: string, title = '提示'): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title,
      content,
      confirmColor: '#e05a7d',
      success: (res) => resolve(!!res.confirm),
      fail: () => resolve(false),
    });
  });
}

export function navigateTo(url: string): void {
  uni.navigateTo({ url });
}

export function switchTab(url: string): void {
  uni.switchTab({ url });
}

export function redirectTo(url: string): void {
  uni.redirectTo({ url });
}
