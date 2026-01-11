import { defineConfig } from 'tsdown'
// 注意添加 with { type: 'json' }
import pkg from './package.json' with { type: 'json' }

const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
  /^node:/,
]

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    platform: 'node',
    outDir: 'dist',
    dts: true,
    external,
    clean: true,
  },
  {
    entry: ['src/runtime/index.ts'],
    format: ['esm'],
    platform: 'neutral',
    outDir: 'dist/runtime',
    dts: true,
    external: ['msw', 'mockjs'],
    alias: {
      '^node:(.*)': 'false',
    },
    define: {
      'process.env.NODE_ENV': '"production"',
    }
  }
])
