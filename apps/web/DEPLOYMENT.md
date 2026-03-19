# AI学伴 部署指南

## 目录

1. [环境要求](#环境要求)
2. [本地开发部署](#本地开发部署)
3. [生产环境部署](#生产环境部署)
4. [配置说明](#配置说明)
5. [常见问题](#常见问题)

---

## 环境要求

### 必需软件

| 软件 | 版本要求 | 说明 |
|------|----------|------|
| Node.js | >= 18.0.0 | JavaScript运行环境 |
| pnpm | >= 8.0.0 | 包管理器 |

### 检查环境

```powershell
# 检查Node.js版本
node --version

# 检查pnpm版本
pnpm --version
```

### 安装pnpm（如未安装）

```powershell
npm install -g pnpm
```

---

## 本地开发部署

### 步骤1: 克隆项目

```powershell
cd D:\AiPorject\AiStudyPartner
```

### 步骤2: 安装依赖

```powershell
pnpm install
```

### 步骤3: 配置API密钥

编辑 `apps/web/public/config.json` 文件，填入您的API密钥：

```json
{
  "llm": {
    "provider": "openai",
    "apiKey": "您的API密钥",
    "baseUrl": "https://api.openai.com/v1/",
    "model": "gpt-4o-mini"
  },
  "tts": {
    "provider": "openai",
    "apiKey": "您的API密钥",
    "baseUrl": "https://api.openai.com/v1/",
    "model": "tts-1",
    "voice": "nova"
  },
  "stt": {
    "provider": "openai",
    "apiKey": "您的API密钥",
    "baseUrl": "https://api.openai.com/v1/",
    "model": "whisper-1"
  }
}
```

### 步骤4: 启动开发服务器

```powershell
pnpm dev
```

### 步骤5: 访问应用

打开浏览器访问：`http://localhost:5173`

---

## 生产环境部署

### 方式一: 静态文件部署

#### 步骤1: 构建生产版本

```powershell
pnpm build
```

构建完成后，静态文件将生成在 `apps/web/dist` 目录。

#### 步骤2: 部署到Web服务器

将 `dist` 目录内容上传到任意静态Web服务器。

**Nginx配置示例：**

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/ai-study-partner;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 启用gzip压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
```

### 方式二: 使用Vercel部署

#### 步骤1: 安装Vercel CLI

```powershell
npm install -g vercel
```

#### 步骤2: 部署

```powershell
cd apps/web
vercel
```

### 方式三: 使用Netlify部署

1. 将项目推送到GitHub
2. 在Netlify中导入项目
3. 设置构建命令：`pnpm build`
4. 设置发布目录：`apps/web/dist`

---

## 配置说明

### API密钥获取

#### OpenAI
1. 访问 https://platform.openai.com/api-keys
2. 创建新的API密钥
3. 复制密钥到配置文件

#### MiniMax
1. 访问 https://www.minimaxi.com/
2. 注册并获取API密钥
3. 复制密钥到配置文件

### 安全建议

⚠️ **重要提示**：API密钥存储在前端配置文件中，存在安全风险。

**生产环境建议方案：**

1. **使用后端代理**：创建后端服务代理API请求
2. **使用环境变量**：在构建时注入环境变量
3. **限制API使用额度**：设置API密钥的使用限额

---

## 常见问题

### Q: 启动后页面空白怎么办？

A: 检查以下项目：
1. 确认依赖已正确安装：`pnpm install`
2. 检查控制台是否有错误信息
3. 确认配置文件格式正确

### Q: 无法连接API服务？

A: 检查以下项目：
1. 确认API密钥正确
2. 确认baseUrl地址正确
3. 检查网络连接
4. 确认API服务可用

### Q: 语音功能不工作？

A: 检查以下项目：
1. 确认浏览器已授权麦克风权限
2. 确认使用HTTPS或localhost（语音API需要安全上下文）
3. 检查TTS/STT配置是否正确

### Q: Live2D模型加载失败？

A: 检查以下项目：
1. 确认模型文件存在于 `public/assets/live2d/` 目录
2. 确认modelPath路径正确
3. 检查浏览器控制台的网络请求

### Q: 如何更换Live2D模型？

A: 
1. 将新模型文件放入 `public/assets/live2d/` 目录
2. 修改 `config.json` 中的 `live2d.modelPath`
3. 刷新页面

---

## 技术支持

如遇到问题，请检查：
1. 浏览器控制台错误信息
2. 网络请求状态
3. 配置文件格式

---

## 更新日志

### v1.0.0
- 初始版本发布
- 支持LLM对话、TTS语音输出、STT语音输入
- 支持Live2D角色动画
- 支持表情同步和口型同步
