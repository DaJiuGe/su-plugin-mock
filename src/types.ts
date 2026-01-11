export interface SuPluginMockOptions {
  /**
   * mock 文件路径
   * @default 'mock'
   */
  mockPath?: string
  /**
   * 模式选择
   * - 'dev': 开发模式，使用 vite-plugin-mock-dev-server
   * - 'prd': 生产模式，使用 MSW 生成 mock，会自动移除 defineMock 包装器
   * @default 'dev'
   * @note 在编写 .mock.ts 文件时，需要手动添加 defineMock() 包装器，例如：
   * export default defineMock({
   *   url: '/api/test',
   *   method: 'get',
   *   response: () => ({ data: 'test' })
   * })
   */
  mode?: 'dev' | 'prd'
  /**
   * MSW 注入文件
   * @default 'src/main.ts'
   */
  entryFile?: string
}
