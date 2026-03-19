# 修复魔塔社区API的CORS跨域问题

## 问题说明
前端应用直接请求魔塔社区API时，浏览器会阻止跨域请求，因为服务器没有返回 `Access-Control-Allow-Origin` 响应头。

## 解决方案
在 `vite.config.ts` 中添加代理配置，让Vite开发服务器作为中间人转发API请求。

## 需要修改的文件
- `d:\AiPorject\AiStudyPartner\apps\web\vite.config.ts`

## 具体修改内容

### 修改前（第20-23行）：
```typescript
server: {
  port: 3000,
  host: true
},
```

### 修改后：
```typescript
server: {
  port: 3000,
  host: true,
  proxy: {
    '/api/modelscope': {
      target: 'https://ms-ens-9a3765a1-f587.api-inference.modelscope.cn',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/modelscope/, '/v1')
    }
  }
},
```

## 代理配置说明

| 配置项 | 说明 |
|--------|------|
| `/api/modelscope` | 匹配所有以 `/api/modelscope` 开头的请求 |
| `target` | 代理目标服务器地址（魔塔社区API） |
| `changeOrigin: true` | 修改请求头中的origin，让目标服务器认为请求来自同源 |
| `rewrite` | 将 `/api/modelscope` 重写为 `/v1` |

## 请求流程变化

**修改前：**
```
浏览器 → https://ms-ens-xxx.modelscope.cn/v1/chat/completions
         ↑ 被CORS策略阻止
```

**修改后：**
```
浏览器 → http://localhost:3000/api/modelscope/chat/completions
       → Vite代理 → https://ms-ens-xxx.modelscope.cn/v1/chat/completions
       → 返回数据 → 浏览器
         ↑ 无跨域问题
```

## config.json 配合修改
确保 `baseUrl` 配置为：
```json
"baseUrl": "/api/modelscope/"
```

## 实施步骤
1. 修改 `vite.config.ts` 添加代理配置
2. 重启开发服务器使配置生效
