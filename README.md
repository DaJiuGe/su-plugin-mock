# su-plugin-mock

一个支持开发/生产双模式的 Vite Mock 插件，开发模式使用 vite-plugin-mock-dev-server，生产模式自动转换为 MSW (Mock Service Worker)。

## 特性

- 🚀 **双模式支持**：开发模式使用 vite-plugin-mock-dev-server，生产模式使用 MSW
- 🔧 **统一的 Mock 定义**：使用 `defineMock` 函数统一定义 Mock 数据，自动适配不同模式
- 🌟 **动态 Mock 能力**：强制 body 为函数形式，确保生产环境构建后依然具备动态 Mock 能力
- 📦 **零侵入性**：生产环境无需修改业务代码，自动注入 MSW 初始化代码
- 🔒 **类型安全**：提供完整的 TypeScript 类型定义

## 安装

```bash
pnpm add -D su-plugin-mock mockjs msw @types/mockjs
```

> 注意：根据约定，安装插件时需要同时安装 `mockjs`、`msw` 和 `@types/mockjs` 依赖。

## 快速开始

### 1. 在 Vite 配置中使用插件

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { suPluginMock } from 'su-plugin-mock'

export default defineConfig({
  plugins: [
    suPluginMock({
      mode: 'dev' // 开发模式使用 vite-plugin-mock-dev-server，生产模式使用 'prd'
    })
  ]
})
```

### 2. 创建 Mock 文件

在项目根目录下创建 `mock` 文件夹，并添加 `.mock.ts` 文件：

```typescript
// mock/api.mock.ts
import { defineMock } from 'su-plugin-mock'

export default defineMock([
  {
    url: '/api/user',
    method: 'GET',
    body: () => ({
      code: 0,
      message: 'success',
      data: {
        name: 'John Doe',
        age: 30
      }
    })
  },
  {
    url: '/api/login',
    method: 'POST',
    body: (ctx) => {
      const { username, password } = ctx.body
      if (username === 'admin' && password === '123456') {
        return {
          code: 0,
          message: 'login success',
          data: {
            token: 'mock-token-123'
          }
        }
      }
      return {
        code: 401,
        message: 'invalid username or password'
      }
    }
  }
])
```

### 3. 启动开发服务器

```bash
pnpm run dev
```

### 4. 生产构建

```bash
pnpm run build
```

## 配置选项

```typescript
interface SuPluginMockOptions {
  /**
   * 模式选择
   * - 'dev': 开发模式，使用 vite-plugin-mock-dev-server
   * - 'prd': 生产模式，使用 MSW 生成 mock
   * @default 'dev'
   */

  mode: 'dev' | 'prd'
  /**
   * Mock 文件路径
   * @default 'mock'
   */
  mockPath?: string

  /**
   * MSW 注入文件
   * @default 'src/main.ts'
   */
  entryFile?: string
}
```

## API 参考

### defineMock

用于定义 Mock 数据的函数。

```typescript
function defineMock(config: MockHttpItem | MockHttpItem[]): MockHttpItem | MockHttpItem[]
```

### MockHttpItem

Mock 配置项类型。

```typescript
interface MockHttpItem {
  /**
   * 请求 URL
   */
  url: string
  
  /**
   * 请求方法
   * @default 'GET'
   */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
  
  /**
   * 响应体函数
   * 必须定义为函数形式，例如：body: () => Mock.mock({ ... })
   */
  body: (ctx: MockContext) => any | Promise<any>
  
  /**
   * 响应拦截函数 (可选)
   */
  response?: (ctx: MockContext) => any | Promise<any>
  
  /**
   * 延迟响应时间（毫秒）
   */
  delay?: number
}
```

### MockContext

Mock 执行上下文类型。

```typescript
interface MockContext {
  /**
   * 查询参数
   */
  query: Record<string, any>
  
  /**
   * 路径参数
   */
  params: Record<string, any>
  
  /**
   * 请求体
   */
  body: Record<string, any>
  
  /**
   * 请求头
   */
  headers: Record<string, any>
  
  /**
   * 其他属性
   */
  [key: string]: any
}
```

## 使用示例

### 1. 基本使用

```typescript
import { defineMock } from 'su-plugin-mock'

export default defineMock({
  url: '/api/test',
  method: 'GET',
  body: () => ({
    code: 0,
    message: 'success',
    data: 'test data'
  })
})
```

### 2. 使用 Mock.js

```typescript
import { defineMock } from 'su-plugin-mock'
import Mock from 'mockjs'

export default defineMock({
  url: '/api/users',
  method: 'GET',
  body: () => Mock.mock({
    'code': 0,
    'message': 'success',
    'data|1-10': [
      {
        'id|+1': 1,
        'name': '@cname',
        'email': '@email'
      }
    ]
  })
})
```

### 3. 处理请求参数

```typescript
import { defineMock } from 'su-plugin-mock'

export default defineMock({
  url: '/api/user/:id',
  method: 'GET',
  body: (ctx) => {
    const { id } = ctx.params
    return {
      code: 0,
      message: 'success',
      data: {
        id,
        name: 'User ' + id,
        email: `user${id}@example.com`
      }
    }
  }
})
```

### 4. 处理 POST 请求

```typescript
import { defineMock } from 'su-plugin-mock'

export default defineMock({
  url: '/api/login',
  method: 'POST',
  body: (ctx) => {
    const { username, password } = ctx.body
    if (username === 'admin' && password === '123456') {
      return {
        code: 0,
        message: 'login success',
        data: {
          token: 'mock-token-123'
        }
      }
    }
    return {
      code: 401,
      message: 'invalid username or password'
    }
  }
})
```

## 开发与生产模式的区别

### 开发模式 (mode: 'dev')

- 使用 vite-plugin-mock-dev-server
- 支持热更新
- 无需额外配置，直接在浏览器中访问 Mock 接口

### 生产模式 (mode: 'prd')

- 自动转换为 MSW
- 在构建时会自动注入 MSW 初始化代码到入口文件
- 生成 mockServiceWorker.js 文件到 dist 目录
- 支持在生产环境中使用 Mock 数据

## 注意事项

1. **body 必须为函数**：在定义 Mock 时，body 必须定义为函数形式，否则会在构建时报错

```typescript
// 错误
body: {
  code: 0,
  message: 'success'
}

// 正确
body: () => ({
  code: 0,
  message: 'success'
})
```

2. **生产模式下的资源路径**：在生产模式下，mockServiceWorker.js 会生成到 dist 目录，确保服务器正确配置该文件的访问路径

3. **跨域问题**：MSW 会拦截所有符合条件的请求，包括跨域请求，无需额外配置 CORS

## License

ISC
