# AI输出优化与系统提示词独立管理计划

## 需求概述

1. **思考过程过滤**: AI回答中会输出`<think`标签的思考过程，需要过滤掉
2. **系统提示词独立管理**: 将系统提示词从config.json中提取到独立的soul.md文档

## 实施计划

### 阶段一: 系统提示词独立管理

#### 任务1.1: 创建soul.md文档
**文件**: `apps/web/public/soul.md`

内容：
- 从config.json中提取当前的systemPrompt内容
- 使用Markdown格式组织，便于编辑和维护
- 包含角色定义、行为规则、输出规范等

#### 任务1.2: 创建系统提示词加载服务
**文件**: `apps/web/src/services/soul.ts`

功能：
- 异步加载soul.md文件内容
- 处理文件读取异常（使用默认提示词作为fallback）
- 支持热更新（开发环境）

#### 任务1.3: 更新配置类型定义
**文件**: `apps/web/src/config/types.ts`

修改：
- 从CharacterConfig中移除systemPrompt字段（或标记为可选）
- 添加soulPath配置项

#### 任务1.4: 更新配置加载器
**文件**: `apps/web/src/config/loader.ts`

修改：
- 加载soul.md内容
- 合并到配置对象中

#### 任务1.5: 更新配置Store
**文件**: `apps/web/src/stores/config.ts`

修改：
- 添加soulContent状态
- 更新加载逻辑

#### 任务1.6: 更新聊天Store
**文件**: `apps/web/src/stores/chat.ts`

修改：
- 从soulContent获取系统提示词

### 阶段二: 思考过程过滤

#### 任务2.1: 创建思考过程过滤器服务
**文件**: `apps/web/src/services/think-filter.ts`

功能：
- 定义常见的思考过程标签模式
- 实现流式文本过滤逻辑
- 处理标签跨chunk的情况

#### 任务2.2: 更新LLM服务集成过滤器
**文件**: `apps/web/src/services/llm.ts`

修改：
- 在streamChat函数中集成思考过程过滤器
- 流式输出时过滤思考过程内容

### 阶段三: 配置文件更新

#### 任务3.1: 更新config.json
**文件**: `apps/web/public/config.json`

修改：
- 移除systemPrompt字段（或保留作为备用）
- 添加soul配置项

#### 任务3.2: 更新配置示例文档
**文件**: `apps/web/public/config.example.json`

修改：
- 更新配置说明

### 阶段四: 测试验证

#### 任务4.1: 功能测试
- 测试soul.md加载
- 测试思考过程过滤
- 测试异常处理（文件不存在等）

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/web/public/soul.md` | 新建 | 系统提示词文档 |
| `apps/web/src/services/soul.ts` | 新建 | 提示词加载服务 |
| `apps/web/src/services/think-filter.ts` | 新建 | 思考过程过滤器 |
| `apps/web/src/config/types.ts` | 修改 | 更新配置类型 |
| `apps/web/src/config/loader.ts` | 修改 | 集成soul加载 |
| `apps/web/src/stores/config.ts` | 修改 | 添加soul状态 |
| `apps/web/src/stores/chat.ts` | 修改 | 使用soul内容 |
| `apps/web/src/services/llm.ts` | 修改 | 集成过滤器 |
| `apps/web/public/config.json` | 修改 | 更新配置结构 |
| `apps/web/public/config.example.json` | 修改 | 更新示例 |

## 技术细节

### soul.md 文件格式
```markdown
# AI学伴角色设定

## 角色信息
- 名称：小伴
- 性格：活泼、耐心、鼓励、友善

## 行为规则
1. 直接回答问题，不要输出任何思考过程
2. 不要使用<think`、<thinking`等任何形式的思考标签
3. 不要使用emoji表情包
4. 用简单、有趣的语言与孩子交流
...

## 输出规范
...
```

### 思考过程标签过滤模式
```typescript
const THINK_PATTERNS = [
  /<think[\s\S]*?<\/think>/gi,
  /<thinking[\s\S]*?<\/thinking>/gi,
  /<thought[\s\S]*?<\/thought>/gi,
  /【思考】[\s\S]*?【\/思考】/g,
]
```

### 异常处理策略
1. soul.md文件不存在时使用默认提示词
2. 文件读取失败时记录错误并使用fallback
3. 确保系统不会因提示词加载失败而崩溃

## 预期效果

1. **提示词独立管理**: 系统提示词可在soul.md中独立编辑，无需修改代码
2. **思考过程过滤**: AI输出中不再包含思考过程标签
3. **易于维护**: 提示词与代码分离，便于非技术人员编辑
4. **健壮性**: 完善的异常处理确保系统稳定运行
