# 图片识别习题功能 - 任务拆解

## 任务列表

### 阶段1: 配置与类型定义

- [ ] **Task 1.1**: 扩展配置文件支持vision配置
  - 修改 `apps/web/public/config.example.json` 添加 vision 配置项
  - 修改 `apps/web/src/config/types.ts` 添加 VisionConfig 接口
  - 修改 `apps/web/src/config/validator.ts` 支持 vision 配置验证
  - **验收标准**:
    - config.example.json 包含完整的 vision 配置示例
    - VisionConfig 接口定义完整且类型正确
    - 配置验证函数能正确识别无效配置

- [ ] **Task 1.2**: 扩展数据类型定义
  - 在 `apps/web/src/config/types.ts` 中扩展 Exercise 接口添加 images 和 hasImageReference 字段
  - 新增 ExerciseImage 接口定义
  - 新增 ImageStatus 类型定义
  - **验收标准**:
    - Exercise 接口包含 images?: string[] 和 hasImageReference?: boolean 字段
    - ExerciseImage 接口包含所有必要字段（id, exerciseIds, base64, thumbnail, createdAt, status, size）
    - ImageStatus 类型定义正确（'pending' | 'ready' | 'used'）

### 阶段2: 核心服务开发

- [ ] **Task 2.1**: 创建图片存储服务
  - 创建 `apps/web/src/services/image-storage.ts`
  - 实现 IndexedDB 的 images 表操作
  - 实现 saveImage(base64): Promise<string> 方法
  - 实现 getImage(id): Promise<ExerciseImage> 方法
  - 实现 deleteImages(ids: string[]): Promise<void> 方法
  - 实现 cleanupExpiredImages(): Promise<void> 方法
  - **验收标准**:
    - IndexedDB 成功创建 images 表
    - saveImage() 返回有效的图片ID
    - getImage() 能正确读取存储的图片
    - deleteImages() 能正确删除指定图片
    - cleanupExpiredImages() 能正确清理过期图片（>7天）
    - 存储空间超50MB时能正确清理最旧图片

- [ ] **Task 2.2**: 创建图片识别服务
  - 创建 `apps/web/src/services/image-exercise-parser.ts`
  - 实现 parseImageToExercises(imageBase64): Promise<ParsedExercise[]> 方法
  - 实现构建硅基流动API请求
  - 实现解析AI返回的JSON结果
  - 实现错误处理和超时处理
  - **验收标准**:
    - 能正确调用硅基流动API
    - 能正确处理 Base64 图片数据格式
    - 能正确解析 AI 返回的 JSON 结果
    - 识别超时（30s）时能正确抛出错误
    - API 请求失败时能正确报错
    - 能处理各种HTTP错误码（400/401/429/500）

### 阶段3: 前端组件开发

- [ ] **Task 3.1**: 创建图片上传组件
  - 创建 `apps/web/src/components/ImageExerciseUploader.vue`
  - 实现拍照功能（调用设备摄像头）
  - 实现相册选择功能
  - 实现图片预览
  - 实现图片压缩（可选）
  - **验收标准**:
    - 支持拍照功能（调用设备摄像头）
    - 支持从相册选择图片
    - 图片预览功能正常
    - 图片格式校验正确（JPEG/PNG/WebP）
    - 图片大小限制正确（10MB）

- [ ] **Task 3.2**: 扩展习题上传组件
  - 修改 `apps/web/src/components/ExerciseUploader.vue`
  - 添加"拍照上传"和"文本上传"Tab切换
  - 集成 ImageExerciseUploader 组件
  - 实现识别进度显示
  - 实现结果预览和确认上传
  - **验收标准**:
    - Tab 切换正常（文本上传/拍照上传）
    - 拍照上传流程完整
    - 识别进度显示正确（"AI正在识别中..."）
    - 解析结果预览正确（习题数量、类型分布）
    - 确认上传后正确存储到 exercises.json
    - 成功上传提示正确

### 阶段4: 集成与功能扩展

- [ ] **Task 4.1**: 集成到家长页面
  - 修改 `apps/web/src/pages/ParentPage.vue`
  - 在习题上传区域添加Tab切换
  - 确保文本上传和图片上传功能并存
  - **验收标准**:
    - ParentPage 正确显示习题上传功能
    - 文本上传和拍照上传功能并存
    - 切换 Tab 不影响其他功能

- [ ] **Task 4.2**: 扩展练习功能支持图片
  - 修改 `apps/web/src/skills/self-practice-skill.ts`
  - 在 showCurrentQuestion() 中加载并显示关联图片
  - 在习题文本中解析 [图片] 标记
  - **验收标准**:
    - 包含图片的习题正确显示图片
    - 图片可点击放大查看
    - 图片与习题文字布局合理

- [ ] **Task 4.3**: 实现清理逻辑
  - 修改 `apps/web/src/services/memory-archive.ts`
  - 在每日总结生成时调用 cleanupExpiredImages()
  - 实现存储空间检查和自动清理
  - **验收标准**:
    - 每日总结时触发清理逻辑
    - 已完成练习超过7天的图片被正确删除
    - 存储空间超50MB时自动清理最旧图片

### 阶段5: 测试与验证

- [ ] **Task 5.1**: 硅基流动API连接测试
  - 配置 API Key 到 config.json
  - 测试单张图片识别功能
  - 验证返回结果格式
  - **验收标准**:
    - API 连接成功
    - 单张图片识别返回正确结果
    - 返回结果格式符合预期

- [ ] **Task 5.2**: 端到端流程测试
  - 测试拍照/选图 → 识别 → 确认 → 存储流程
  - 测试练习时图片展示
  - 测试清理机制触发
  - **验收标准**:
    - 完整流程无报错
    - 练习时图片正确展示
    - 清理机制能正确触发

---

## 任务依赖关系

```
Task 1.1 (配置) ──────────────────┐
                                 │
Task 1.2 (类型) ─────────────────┼──▶ Task 2.1 (存储服务) ──┬──▶ Task 3.1 (图片上传组件)
                                 │                         │
                                 │                         └──▶ Task 3.2 (习题上传组件) ──▶ Task 4.1 (集成)
                                 │
Task 2.2 (识别服务) ─────────────┘
                                 │
                                 └──────────────────────────▶ Task 4.2 (练习图片支持)

Task 4.3 (清理逻辑) 独立，可在任意阶段实现
Task 5.1 和 Task 5.2 在所有功能完成后执行
```

---

## 任务优先级

1. **P0 (阻塞)**: Task 1.1, Task 1.2, Task 2.1, Task 2.2
2. **P1 (核心)**: Task 3.1, Task 3.2, Task 4.1
3. **P2 (重要)**: Task 4.2, Task 4.3
4. **P3 (验证)**: Task 5.1, Task 5.2

---

## 预计工时

| 任务 | 预计工时 |
|------|----------|
| Task 1.1 | 1小时 |
| Task 1.2 | 0.5小时 |
| Task 2.1 | 2小时 |
| Task 2.2 | 2小时 |
| Task 3.1 | 3小时 |
| Task 3.2 | 2小时 |
| Task 4.1 | 1小时 |
| Task 4.2 | 1.5小时 |
| Task 4.3 | 1小时 |
| Task 5.1 | 0.5小时 |
| Task 5.2 | 1小时 |
| **总计** | **15.5小时** |
