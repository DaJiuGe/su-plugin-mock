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
      entryFile: 'src/main.ts',
      ...options,
    };
  }

  public createPlugin(): Plugin {
    const self = this;
    const { name, virtualId, resolvedVirtualId, virtualLibId, resolvedVirtualLibId, options } = this;

    return {
      name,
      configResolved: (config) => { self.viteConfig = config; },

      config() {
        return {
          resolve: {
            alias: [
              { find: 'vite-plugin-mock-dev-server', replacement: virtualLibId },
              { find: 'su-plugin-mock/runtime', replacement: virtualLibId },
              { find: 'su-plugin-mock', replacement: virtualLibId }
            ]
          },
          build: {
            rollupOptions: {
              external: [/^node:.*$/]
            }
          }
        };
      },

      resolveId(id) {
        if (id === virtualId) {
          return resolvedVirtualId;
        }
        if ([virtualLibId, 'vite-plugin-mock-dev-server', 'su-plugin-mock/runtime'].includes(id)) {
          return resolvedVirtualLibId;
        }
        return null;
      },

      async load(id: string) {
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

          return `
            ${imports}
            import { createMswHandler } from '${virtualLibId}'; 
            export const handlers = [${configs}].map(createMswHandler);
          `;
        }

        if (id === resolvedVirtualLibId) {
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

          // 核心：因为我们在 index.ts 强制了 body 是函数
          // 这里直接执行 body(ctx) 即可
          let result = typeof body === 'function' ? await body(ctx) : (await response?.(ctx) || body);
          
          const data = Mock.mock(result);
          if (delayTime) await delay(delayTime);
          return HttpResponse.json(data);
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
        if (!id.replace(/\\/g, '/').endsWith(options.entryFile)) return null;
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
