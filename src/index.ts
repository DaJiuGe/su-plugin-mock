import { PluginOption } from 'vite';
import { MockDevPlugin } from './MockDevPlugin';
import { MockPrdPlugin } from './MockPrdPlugin';
import { SuPluginMockOptions } from './types';
// 仅导入原类型用于继承，不再重新导出它
import type { MockHttpItem as VendorMockHttpItem } from 'vite-plugin-mock-dev-server';

export type { SuPluginMockOptions } from './types';

/**
 * 定义 Mock 执行上下文类型
 */
export interface MockContext {
  query: Record<string, any>;
  params: Record<string, any>;
  body: Record<string, any>;
  headers: Record<string, any>;
  [key: string]: any;
}

/**
 * 重新定义 MockHttpItem
 * 强制 body 必须为函数，以确保在生产环境构建后依然具备动态 Mock 能力
 */
export type MockHttpItem = Omit<VendorMockHttpItem, 'body' | 'response'> & {
  /**
   * 响应体函数。
   * 必须定义为函数形式，例如：body: () => Mock.mock({ ... })
   */
  body: (ctx: MockContext) => any | Promise<any>;
  /**
   * 响应拦截函数 (可选)
   */
  response?: (ctx: MockContext) => any | Promise<any>;
};

/**
 * 严格类型的 defineMock 包装器
 * 这样在 .mock.ts 中使用时，不符合函数要求的 body 会立即报错
 */
export function defineMock(config: MockHttpItem | MockHttpItem[]): MockHttpItem | MockHttpItem[] {
  return config;
}

const DEFAULT_OPTIONS: SuPluginMockOptions = {
  mockPath: 'mock',
  mode: 'dev',
  injectFile: 'src/main.ts'
};

export function suPluginMock(options: SuPluginMockOptions = {}): PluginOption[] {
  const opt = { ...DEFAULT_OPTIONS, ...options } as Required<SuPluginMockOptions>;

  if (opt.mode === 'prd') {
    return [new MockPrdPlugin(opt).createPlugin()];
  } else {
    const plugin = new MockDevPlugin(opt);
    return plugin.createPlugin();
  }
}
