import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { MockPrdTemplate } from './MockPrdTemplate';
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

  constructor(options: Required<SuPluginMockOptions>) {
    this.options = options
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
          return MockPrdTemplate.generateVirtualLibCode();
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
        if (!id.replace(/\\\\/g, '/').endsWith(options.entryFile)) return null;
        const base = self.viteConfig?.base || '/';
        const normalizedBase = base.endsWith('/') ? base : `${base}/`;
        const initCode = MockPrdTemplate.generateMSWInitCode(virtualId, normalizedBase);

        return {
          code: `${initCode}${code}`,
          map: null
        };
      }
    };
  }
}
