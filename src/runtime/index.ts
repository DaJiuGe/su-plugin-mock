import Mock from 'mockjs';
import { delay, http, HttpResponse } from 'msw';

export const defineMock = (config: any) => config;
export const defineMockConfig = (config: any) => config;

export function createMswHandler(config: any) {
  const { url, method = 'GET', body, response, delay: delayTime } = config;
  const methodLower = (method?.toLowerCase() || 'get') as keyof typeof http;

  return http[methodLower](url, async (req: any) => {
    const urlObj = new URL(req.request.url);

    let requestBody = {};
    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      try {
        const cloned = req.request.clone();
        requestBody = await cloned.json();
      } catch (e) {
        requestBody = {};
      }
    }

    const mockContext = {
      params: req.params,
      query: Object.fromEntries(urlObj.searchParams),
      body: requestBody
    };

    let result;
    if (typeof body === 'function') {
      result = await body(mockContext);
    } else if (typeof response === 'function') {
      result = await response(mockContext);
    } else {
      result = body;
    }

    const finalData = Mock.mock(result);
    if (delayTime) await delay(delayTime);

    return HttpResponse.json(finalData);
  });
}
