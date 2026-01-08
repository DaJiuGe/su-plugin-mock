const { Mock } = require('./dist/index.js')

// 测试 Mock.mock 功能
const mockData = Mock.mock({
  'code': 0,
  'message': 'mock dynamic response',
  'data|1-10': [{
    'id|+1': 1,
    'name': '@cname',
    'age|18-60': 1,
    'email': '@email'
  }]
})

console.log('Mock data:', JSON.stringify(mockData, null, 2))