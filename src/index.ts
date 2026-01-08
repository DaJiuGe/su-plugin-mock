import Mock from 'mockjs';
import { PluginOption } from 'vite';
import { MockDevPlugin } from './MockDevPlugin';
import { MockPrdPlugin } from './MockPrdPlugin';
import { SuPluginMockOptions } from './types';

export { defineMock } from 'vite-plugin-mock-dev-server';
export type { MockHttpItem } from 'vite-plugin-mock-dev-server';
export type { SuPluginMockOptions } from './types';
export { Mock };

const DEFAULT_OPTIONS: SuPluginMockOptions = {
  mockPath: 'mock',
  mode: 'dev',
  injectFile: 'src/main.ts'
};

export function suPluginMock(options: SuPluginMockOptions = {}): PluginOption[] {
  const opt = { ...DEFAULT_OPTIONS, ...options } as Required<SuPluginMockOptions>;
  if (options.mode === 'prd') {
    const plugin = new MockPrdPlugin(opt);
    return plugin.createPlugin();
  } else {
    const plugin = new MockDevPlugin(opt);
    return plugin.createPlugin();
  }
}

