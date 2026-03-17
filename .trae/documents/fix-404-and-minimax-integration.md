# 修复404错误并集成MiniMax LLM计划

## 问题分析

### 问题1：404错误排查

**根本原因**：Vite配置问题导致服务器无法正确找到入口文件

当前配置：
- 根目录 `package.json` 脚本：`"dev": "vite --config apps/web/vite.config.ts"`
- `apps/web/vite.config.ts` 没有设置 `root` 属性
- Vite默认以执行命令的目录（项目根目录）作为工作目录
- 但 `index.html` 和 `src/main.ts` 都在 `apps/web/` 目录下

**问题**：Vite在根目录找不到 `index.html`，导致404错误

### 问题2：MiniMax API兼容性

根据文档 `docs/minimax-openaiAPI兼容.md`：
- MiniMax支持OpenAI API兼容模式
- Base URL: `https://api.minimaxi.com/v1`
- 支持的模型：MiniMax-M2.5, MiniMax-M2.5-highspeed, MiniMax-M2.1等
- **重要**：temperature参数取值范围为(0.0, 1.0]，推荐使用1.0
- 当前代码默认temperature为0.7，符合要求

**兼容性评估**：当前项目代码已支持OpenAI兼容API，只需更新配置即可

---

## 实施计划

### 任务1：修复Vite配置解决404错误

**步骤1.1**：修改 `apps/web/vite.config.ts`
- 添加 `root` 配置明确指定工作目录
- 确保服务器能正确找到 `index.html`

**步骤1.2**：验证修复
- 启动开发服务器
- 访问 http://localhost:3000 确认页面正常

### 任务2：更新配置支持MiniMax

**步骤2.1**：更新配置类型定义
- 文件：`apps/web/src/config/types.ts`
- 添加 'minimax' 到 provider 联合类型

**步骤2.2**：更新默认配置文件
- 文件：`apps/web/public/config.json`
- 更新为MiniMax配置示例
- 设置正确的baseUrl和模型名称
- temperature设为1.0（MiniMax推荐值）

**步骤2.3**：更新LLM服务（可选优化）
- 文件：`apps/web/src/services/llm.ts`
- 添加temperature范围校验（确保在0.0-1.0范围内）

### 任务3：验证测试

**步骤3.1**：验证Web页面访问
- 启动开发服务器
- 确认 http://localhost:3000 正常访问
- 检查控制台无错误

**步骤3.2**：验证MiniMax API配置
- 检查配置文件加载正常
- 确认API调用参数正确

---

## 文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `apps/web/vite.config.ts` | 添加 `root: resolve(__dirname)` 配置 |
| `apps/web/public/config.json` | 更新为MiniMax配置示例 |
| `apps/web/src/config/types.ts` | 添加 'minimax' provider类型 |
| `apps/web/src/services/llm.ts` | 添加temperature参数校验（可选） |

---

## 预期结果

1. 访问 http://localhost:3000 能正常显示AI学伴页面
2. 配置MiniMax API Key后能正常进行对话
3. 流式响应正常工作
