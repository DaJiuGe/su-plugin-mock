export class MockPrdTemplate {
  /**
   * 生成虚拟库代码
   */
  public static generateVirtualLibCode(): string {
    return `
      import Mock from 'mockjs';
      import { http, HttpResponse, delay } from 'msw';

      export const defineMock = (config) => config;

      export function createMswHandler(item) {
        const { url, method = 'GET', body, response, delay: delayTime } = item;
        return http[method.toLowerCase()](url, async (req) => {
          const ctx = {
            query: Object.fromEntries(new URL(req.request.url).searchParams),
            params: req.params,
            body: await req.request.clone().json().catch(() => ({})),
            headers: Object.fromEntries(req.request.headers)
          };

          let result = typeof body === 'function' ? await body(ctx) : (await response?.(ctx) || body);
          
          const data = Mock.mock(result);
          if (delayTime) await delay(delayTime);
          return HttpResponse.json(data);
        });
      }
    `;
  }

  /**
   * 生成MSW初始化代码
   */
  public static generateMSWInitCode(virtualId: string, baseUrl: string): string {
    return `
/* --- [su-plugin-mock] MSW START --- */
(function() {
  const init = () => {
    Promise.all([
      import('msw/browser'),
      import('${virtualId}')
    ]).then(function(res) {
      const worker = res[0].setupWorker(...res[1].handlers);
      worker.start({
        onUnhandledRequest: 'bypass',
        serviceWorker: { 
          url: '${baseUrl}mockServiceWorker.js', 
          options: { scope: '${baseUrl}' } 
        }
      });
    }).catch(err => {
      console.error('[su-plugin-mock] Failed to initialize:', err);
    });
  };
  if (document.readyState === 'complete' || document.readyState === 'interactive') init();
  else window.addEventListener('DOMContentLoaded', init);
})();
/* --- [su-plugin-mock] END --- */
`;
  }
}
