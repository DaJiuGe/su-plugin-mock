import { MockHttpItem } from 'vite-plugin-mock-dev-server';
import { Mock } from '../src';

export default [
  {
    url: '/api/test',
    method: 'GET',
    response: {
      code: 0,
      message: 'success',
      data: {
        name: 'test',
        value: 123
      }
    }
  },
  {
    url: '/api/dynamic',
    method: 'POST',
    response: (req: any) => {
      return {
        code: 0,
        message: 'dynamic response',
        data: {
          body: req.body,
          timestamp: Date.now()
        }
      }
    }
  },
  {
    url: '/api/mock-dynamic',
    method: 'POST',
    response: Mock.mock({
      'code': 0,
      'message': 'mock dynamic response',
      'data|1-10': [{
        'id|+1': 1,
        'name': '@cname',
        'age|18-60': 1,
        'email': '@email'
      }]
    })
  },
  {
    url: '/api/delay',
    method: 'GET',
    delay: 1000,
    response: {
      code: 0,
      message: 'delayed response',
      data: 'this response is delayed by 1 second'
    }
  }
] as MockHttpItem[]
