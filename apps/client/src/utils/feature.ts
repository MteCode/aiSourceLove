/**
 * 功能开关。
 *
 * 第一版小程序不含支付：微信支付要商户号和资质，而婚恋类目资质还在办。
 * 但代码不能靠"注释掉入口"来关功能——散在 7 个页面里，将来打开时必然漏掉一两处，
 * 而漏掉的那处点下去是个死页面。所以统一收敛到这里，开支付时只改 .env 一行。
 */

/** 支付相关入口（开通会员、我的权益、我的订单）是否展示 */
export const PAY_ENABLED = import.meta.env.VITE_FEATURE_PAY === 'on';

/**
 * 微信一键登录是否展示。
 *
 * 后端没配 WX_MINI_APP_ID / WX_MINI_APP_SECRET 时，这个按钮点下去必然报错。
 * 摆一个必然失败的按钮比没有更糟——用户会以为是自己网络有问题，反复点。
 * 小程序账号下来后把 .env 里改成 on。
 */
export const WX_LOGIN_ENABLED = import.meta.env.VITE_FEATURE_WX_LOGIN === 'on';

/**
 * 权益不足时的引导。
 *
 * 支付开着就引导去开通；关着的时候不能只说"次数不足"就完事——
 * 用户会以为是 bug。得告诉他还有别的路可走：找红娘。
 */
export async function promptUpgrade(message: string, title = '提示'): Promise<boolean> {
  if (!PAY_ENABLED) {
    await new Promise<void>((resolve) => {
      uni.showModal({
        title,
        content: `${message}。当前会员服务正在筹备中，需要更多次数请联系您的专属红娘。`,
        showCancel: false,
        confirmText: '知道了',
        complete: () => resolve(),
      });
    });
    return false;
  }

  return new Promise<boolean>((resolve) => {
    uni.showModal({
      title,
      content: `${message}，开通会员可获得更多次数`,
      confirmText: '去开通',
      cancelText: '再看看',
      success: (r) => resolve(!!r.confirm),
      fail: () => resolve(false),
    });
  });
}

/** 跳去开通会员。支付未开时给出替代路径，绝不跳到一个用不了的页面 */
export function goVip(): void {
  if (!PAY_ENABLED) {
    uni.showModal({
      title: '会员服务筹备中',
      content: '开通会员功能即将上线，现在可以联系您的专属红娘了解权益。',
      showCancel: false,
      confirmText: '知道了',
    });
    return;
  }
  uni.navigateTo({ url: '/pages/vip/index' });
}
