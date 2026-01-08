import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs';
import fs from 'node:fs';
import { dirname, join } from 'path';
import { Plugin, ResolvedConfig } from 'vite';
import { type MockHttpItem } from 'vite-plugin-mock-dev-server';
import { MockPrdTemplate } from './MockPrdTemplate';
import { SuPluginMockOptions } from './types';

const MSW_INJECT_CODE = `import { worker } from './mockServiceWorker.js'; worker.start();`;

export class MockPrdPlugin {
  private readonly options: Required<SuPluginMockOptions>;
  private readonly templateHandler: MockPrdTemplate;
  private resolvedConfig?: ResolvedConfig;

  constructor(options: Required<SuPluginMockOptions>) {
    this.options = options
    this.templateHandler = new MockPrdTemplate();
  }

  public createPlugin(): Plugin[] {
    const plugins: Plugin[] = [];

    const buildPlugin: Plugin = {
      name: 'su-plugin-mock-build',
      enforce: 'pre',
      apply: 'build',
      configResolved: (config: ResolvedConfig) => {
        this.resolvedConfig = config;
      },
      generateBundle: async () => {
        if (this.resolvedConfig?.mode === 'production') {
          await this.generateMSWWorker();
          this.injectMSWCode();
        }
      }
    };

    plugins.push(buildPlugin);

    return plugins;
  }

  private getFiles(dir: string, files: string[] = []): string[] {
    const entries = existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : [];
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        this.getFiles(path, files);
      } else if (entry.isFile()) {
        files.push(path);
      }
    }
    return files;
  }

  private async generateMSWWorker(): Promise<void> {
    if (!this.resolvedConfig) return;

    const mockPath = join(this.resolvedConfig.root, this.options.mockPath);
    if (!existsSync(mockPath)) return;

    const files = this.getFiles(mockPath);
    const mockItems: (MockHttpItem & { statusCode?: number })[] = [];

    for (const file of files) {
      if (file.endsWith('.mock.ts') || file.endsWith('.mock.js')) {
        const content = fs.readFileSync(file, 'utf-8');
        const transformedContent = this.transformMockContent(content);

        try {
          const mockData = await this.evaluateMockContent(transformedContent, file);
          if (Array.isArray(mockData)) {
            mockItems.push(...mockData);
          } else if (mockData) {
            mockItems.push(mockData);
          }
        } catch (error) {
          console.error('Failed to evaluate mock file:', file, error);
        }
      }
    }

    const workerContent = this.templateHandler.generateWorkerContent(mockItems);
    const distDir = join(this.resolvedConfig.build.outDir, 'public');
    if (!existsSync(distDir)) {
      mkdirSync(distDir, { recursive: true });
    }
    writeFileSync(join(distDir, 'mockServiceWorker.js'), workerContent);
  }

  private transformMockContent(content: string): string {
    let transformed = content.replace(/import\s*\{[^}]*defineMock[^}]*\}\s*from\s*['"][^'"]*['"]\s*;/g, '');
    transformed = transformed.replace(/export\s+default\s+defineMock\(([^)]+)\)/g, 'export default $1');
    return transformed;
  }

  private async evaluateMockContent(content: string, filePath: string): Promise<any> {
    const module = {
      exports: {}
    };

    const commonJSContent = content
      .replace(/export\s+default\s+(\S[^;\n]*)/g, 'module.exports = $1;')
      .replace(/export\s+const\s+(\w+)\s*=/g, 'exports.$1 = ')
      .replace(/export\s+function\s+(\w+)/g, 'exports.$1 = function $1');

    try {
      const requireFunc = (path: string) => {
        if (path.startsWith('.')) {
          const resolvedPath = join(dirname(filePath), path);
          return require(resolvedPath);
        }
        return require(path);
      };

      const evalFunc = new Function('requireFunc', 'module', 'exports', `(function(require, module, exports) { ${commonJSContent} })(requireFunc, module, module.exports);`);
      evalFunc(requireFunc, module, module.exports);

      return module.exports;
    } catch (error) {
      console.error('Failed to evaluate mock content:', filePath, error);
      throw error;
    }
  }

  private injectMSWCode(): void {
    if (!this.resolvedConfig) return;

    const injectFilePath = join(this.resolvedConfig.root, this.options.injectFile);
    if (existsSync(injectFilePath)) {
      const content = fs.readFileSync(injectFilePath, 'utf-8');
      if (!content.includes(MSW_INJECT_CODE)) {
        fs.writeFileSync(
          injectFilePath,
          `${MSW_INJECT_CODE}\n${content}`
        );
      }
    }
  }
}
