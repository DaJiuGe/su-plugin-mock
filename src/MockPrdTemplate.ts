import { MockHttpItem } from 'vite-plugin-mock-dev-server';

export class MockPrdTemplate {
  /**
   * 生成单个MSW请求处理器代码
   */
  public generateMSWHandler(item: MockHttpItem & { statusCode?: number }): string {
    const { url, method = 'get', response, statusCode = 200, delay } = item;

    let responseHandler = '';
    if (typeof response === 'function') {
      responseHandler = `(req, res, ctx) => {
        const result = (${response.toString()})(req, res, ctx)
        return res(
          ctx.status(${statusCode}),
          ctx.json(result)
        )
      }`;
    } else if (typeof response === 'object') {
      responseHandler = `(_req, res, ctx) => res(
        ctx.status(${statusCode}),
        ctx.json(${JSON.stringify(response)})
      )`;
    } else {
      responseHandler = `(_req, res, ctx) => res(
        ctx.status(${statusCode}),
        ctx.text(${JSON.stringify(String(response))})
      )`;
    }

    if (delay) {
      responseHandler = `(req, res, ctx) => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(${responseHandler})(req, res, ctx)
          }, ${delay})
        })
      }`;
    }

    const methodStr = Array.isArray(method) ? method[0] : method;
    return `worker.use(
  rest.${(methodStr as string).toLowerCase()}(${JSON.stringify(url)}, ${responseHandler})
)`;
  }

  /**
   * 生成完整的MSW Worker内容
   */
  public generateWorkerContent(mockItems: (MockHttpItem & { statusCode?: number })[]): string {
    return `
/* eslint-disable */
/* tslint:disable */
/* msw:generated */
import { setupWorker, rest, graphql } from 'msw'

const worker = setupWorker()

${mockItems.map(item => this.generateMSWHandler(item)).join('\n\n')}

worker.start()
export { worker }
      `.trim();
  }
}
