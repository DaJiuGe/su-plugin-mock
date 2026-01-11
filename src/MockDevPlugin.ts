import { Plugin } from 'vite';
import { mockDevServerPlugin } from 'vite-plugin-mock-dev-server';
import { SuPluginMockOptions } from './types';

export class MockDevPlugin {
  private readonly options: Required<SuPluginMockOptions>;

  constructor(options: Required<SuPluginMockOptions>) {
    this.options = options
  }

  public createPlugin(): Plugin[] {
    const plugins: Plugin[] = [];

    const proxyCheckPlugin: Plugin = {
      name: 'su-plugin-mock-dev-proxy-check',
      enforce: 'pre',
      apply: 'serve',
      config: (config) => {
        if (!config.server?.proxy) {
          config.server = config.server || {};
          config.server.proxy = { '/v1': { changeOrigin: true, secure: false } };
        }
        return config;
      }
    };

    const mockPlugins: Plugin[] = mockDevServerPlugin({
      dir: this.options.mockPath,
      build: false,
      log: 'debug'
    });

    plugins.push(proxyCheckPlugin, ...mockPlugins);

    return plugins;
  }
}
