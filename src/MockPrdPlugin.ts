import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { SuPluginMockOptions } from './types';

const require = createRequire(import.meta.url);

export class MockPrdPlugin {
  private name = 'su-plugin-mock-prd';
  private virtualId = 'virtual:mock-handlers';
  private resolvedVirtualId = '\0' + this.virtualId;

  private virtualLibId = 'virtual:su-plugin-mock-lib';
  private resolvedVirtualLibId = '\0' + this.virtualLibId;

  private options: Required<SuPluginMockOptions>;
  private viteConfig?: ResolvedConfig;

  constructor(options: SuPluginMockOptions = {}) {
    this.options = {
      mockPath: 'mock',
      mode: 'prd',
      injectFile: 'src/main.ts',
      ...options,
    };
  }

  public createPlugin(): Plugin {
    const self = this;
    const { virtualId, resolvedVirtualId, virtualLibId, resolvedVirtualLibId, options } = this;

    return {
      name: MockPrdPlugin.name,
      configResolved: (config) => { self.viteConfig = config; },

      config() {
        return {
          resolve: {
            alias: [
              // 关键：将所有可能的库引用全部重定向到虚拟模块的 ID
              // 这确保了无论是扫描阶段还是打包阶段，都不会出现裸模块名
              { find: 'vite-plugin-mock-dev-server', replacement: virtualLibId },
              { find: 'su-plugin-mock/runtime', replacement: virtualLibId },
              { find: 'su-plugin-mock', replacement: virtualLibId }
            ]
          },
          build: {
            rollupOptions: {
              // 彻底排除 Node 模块，防止扫描插件主入口
              external: [/^node:.*$/, 'fs', 'path', 'os', 'events', 'stream']
            }
          }
        };
      },

      resolveId(id) {
        if (id === virtualId) return resolvedVirtualId;
        // 处理被 alias 拦截后的虚拟库请求
        if (id === virtualLibId || id === 'vite-plugin-mock-dev-server' || id === 'su-plugin-mock/runtime') {
          return resolvedVirtualLibId;
        }
        return null;
      },

      async load(id: string) {
        // 1. 扫描 Mock 文件并生成聚合代码
        if (id === resolvedVirtualId) {
          const fg = (await import('fast-glob')).default;
          const pattern = path.posix.join(options.mockPath, '**/*.mock.{ts,js}');
          const files = await fg(pattern, { absolute: true });

          const imports = files
            .map((file, i) => `import m${i} from '${file.replace(/\\/g, '/')}';`)
            .join('\n');
          const configs = files
            .map((_, i) => `...(Array.isArray(m${i}) ? m${i} : [m${i}])`)
            .join(', ');

          // 注意：此处必须使用虚拟 ID，不能用物理包名
          return `
            ${imports}
            import { createMswHandler } from '${virtualLibId}'; 
            export const handlers = [${configs}].map(createMswHandler);
          `;
        }

        // 2. 虚拟 Runtime 逻辑：直接提供浏览器可运行的代码
        if (id === resolvedVirtualLibId) {
          return `
    import Mock from 'mockjs';
    import { delay, http, HttpResponse } from 'msw';

    export const defineMock = (c) => c;
    export const defineMockConfig = (c) => c;

    export function createMswHandler(config) {
      // 提取配置
      const { url, method = 'GET', body, response, delay: delayTime } = config;
      const methodLower = (method?.toLowerCase() || 'get');

      return http[methodLower](url, async (req) => {
        const urlObj = new URL(req.request.url);
        let requestBody = {};
        
        // 解析请求体 (用于 Mock 函数的入参)
        if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
          try { 
            const cloned = req.request.clone(); 
            requestBody = await cloned.json(); 
          } catch (e) { requestBody = {}; }
        }

        const ctx = { 
          params: req.params, 
          query: Object.fromEntries(urlObj.searchParams), 
          body: requestBody 
        };
        
        // --- 核心修复点：动态求值 ---
        let rawData;
        if (typeof response === 'function') {
          rawData = await response(ctx);
        } else if (typeof body === 'function') {
          rawData = await body(ctx);
        } else {
          // 如果是普通对象，依然要通过 Mock.mock 处理一遍，以支持 @id, @name 等指令
          rawData = body || response;
        }

        // 关键：在这里执行 Mock.mock，确保每次请求返回的数据都是新生成的随机值
        const finalData = Mock.mock(rawData);

        if (delayTime) await delay(delayTime);

        return HttpResponse.json(finalData);
      });
    }
  `;
        }
        return null;
      },

      async generateBundle() {
        try {
          const mswPath = require.resolve('msw/mockServiceWorker.js');
          this.emitFile({
            type: 'asset',
            fileName: 'mockServiceWorker.js',
            source: fs.readFileSync(mswPath, 'utf-8'),
          });
        } catch (e) { }
      },

      transform: (code, id) => {
        if (!id.replace(/\\/g, '/').endsWith(options.injectFile)) return null;
        const base = self.viteConfig?.base || '/';
        const normalizedBase = base.endsWith('/') ? base : `${base}/`;

        return {
          code: `
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
          url: '${normalizedBase}mockServiceWorker.js', 
          options: { scope: '${normalizedBase}' } 
        }
      });
    }).catch(err => {
      console.error('[su-plugin-mock] Failed to initialize:', err);
    });
  };
  if (document.readyState === 'complete' || document.readyState === 'interactive') init();
  else window.addEventListener('DOMContentLoaded', init);
})();
/* --- [su-plugin-mock] END --- */\n${code}`,
          map: null
        };
      }
    };
  }
}
