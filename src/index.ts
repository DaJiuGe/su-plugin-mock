import { PluginOption } from 'vite';
import type { MockHttpItem as VendorMockHttpItem } from 'vite-plugin-mock-dev-server';
import { MockDevPlugin } from './MockDevPlugin';
import { MockPrdPlugin } from './MockPrdPlugin';
import { SuPluginMockOptions } from './types';

export type { SuPluginMockOptions } from './types';

export interface MockContext {
  query: Record<string, any>;
  params: Record<string, any>;
  body: Record<string, any>;
  headers: Record<string, any>;
  [key: string]: any;
}

export type MockHttpItem = Omit<VendorMockHttpItem, 'body' | 'response'> & {
  body: (ctx: MockContext) => any | Promise<any>;
  response?: (ctx: MockContext) => any | Promise<any>;
};

export function defineMock(config: MockHttpItem | MockHttpItem[]): MockHttpItem | MockHttpItem[] {
  return config;
}

const DEFAULT_OPTIONS: SuPluginMockOptions = {
  mockPath: 'mock',
  mode: 'dev',
  entryFile: 'src/main.ts'
};

export function suPluginMock(options: SuPluginMockOptions = {}): PluginOption[] {
  const opt = { ...DEFAULT_OPTIONS, ...options } as Required<SuPluginMockOptions>;

  if (opt.mode === 'prd') {
    return [new MockPrdPlugin(opt).createPlugin()];
  } else {
    return [new MockDevPlugin(opt).createPlugin()];
  }
}
