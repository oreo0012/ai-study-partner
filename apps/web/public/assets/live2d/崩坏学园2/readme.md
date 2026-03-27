# Live2D 模型文件结构说明

本文档说明 Live2D Cubism 4 模型 ZIP 压缩包的标准文件结构，以确保程序能够正确解析并加载模型。

---

## 一、ZIP 压缩包内文件结构概览

```
模型名称.zip
├── xxx.model3.json          ← 【核心】模型配置文件（入口文件）
├── xxx.moc3                 ← 【必需】模型数据文件
├── xxx.png                  ← 【必需】纹理图片（可以有多个）
├── xxx.physics3.json        ← 【可选】物理效果配置
├── xxx.pose3.json           ← 【可选】姿势配置
├── xxx.cdi3.json            ← 【可选】参数显示信息
├── xxx.userdata3.json       ← 【可选】用户自定义数据
├── motions/                 ← 【可选】动作文件夹
│   ├── idle.motion3.json    ← 待机动作
│   ├── tap_body.motion3.json ← 点击动作
│   └── ...
├── expressions/             ← 【可选】表情文件夹
│   ├── happy.exp3.json      ← 开心表情
│   ├── sad.exp3.json        ← 悲伤表情
│   └── ...
└── sounds/                  ← 【可选】音效文件夹
    └── xxx.wav              ← 动作配合的音效
```

---

## 二、各文件类型详细说明

### 1. 模型配置文件 (model3.json) - 推荐

| 属性 | 说明 |
|------|------|
| **文件扩展名** | `.model3.json` |
| **作用** | 模型的入口配置文件，定义所有资源文件的引用路径 |
| **命名规范** | 通常与模型同名，如 `haru.model3.json` |

**JSON 结构示例：**

```json
{
  "Version": 3,
  "FileReferences": {
    "Moc": "haru.moc3",
    "Textures": [
      "haru.2048/texture_00.png",
      "haru.2048/texture_01.png"
    ],
    "Physics": "haru.physics3.json",
    "Pose": "haru.pose3.json",
    "Motions": {
      "Idle": [
        {"File": "motions/haru_g_idle01.motion3.json"},
        {"File": "motions/haru_g_idle02.motion3.json"}
      ],
      "TapBody": [
        {
          "File": "motions/haru_g_m15.motion3.json",
          "Sound": "sounds/tap.wav"
        }
      ]
    },
    "Expressions": [
      {"Name": "happy", "File": "expressions/happy.exp3.json"},
      {"Name": "sad", "File": "expressions/sad.exp3.json"}
    ]
  },
  "Groups": [],
  "HitAreas": [
    {"Name": "Head", "Id": "Param"},
    {"Name": "Body", "Id": "Param"}
  ],
  "Layout": {
    "CenterX": 0,
    "CenterY": 0.5
  }
}
```

**解析过程作用：**

- 程序首先读取此文件，获取所有资源文件的相对路径
- 根据 `FileReferences` 中的路径加载其他资源

---

### 2. 模型数据文件 (moc3) - 必需

| 属性 | 说明 |
|------|------|
| **文件扩展名** | `.moc3` |
| **作用** | 包含模型的网格、参数、绑定等核心数据 |
| **命名规范** | 通常与模型同名 |

**解析过程作用：**

- 定义模型的所有可动参数（如眼睛、嘴巴、身体角度等）
- 包含模型的绘制数据（顶点、UV、纹理索引等）
- **一个 ZIP 包内必须有且仅有一个 `.moc3` 文件**

---

### 3. 纹理图片 (png) - 必需

| 属性 | 说明 |
|------|------|
| **文件扩展名** | `.png` |
| **作用** | 模型的贴图纹理 |
| **命名规范** | 可放在子目录中，如 `textures/texture_00.png` |

**解析过程作用：**

- 为模型提供颜色和图案
- 一个模型可以有多个纹理文件
- **ZIP 包内至少需要一个 `.png` 纹理文件**

---

### 4. 物理效果配置 (physics3.json) - 可选

| 属性 | 说明 |
|------|------|
| **文件扩展名** | `.physics3.json` |
| **作用** | 定义头发、衣服等的物理摆动效果 |
| **命名规范** | 通常包含 `physics` 关键字 |

**解析过程作用：**

- 定义物理参数（长度、质量、阻尼等）
- 将物理效果映射到模型参数

---

### 5. 姿势配置 (pose3.json) - 可选

| 属性 | 说明 |
|------|------|
| **文件扩展名** | `.pose3.json` |
| **作用** | 定义各部件的显示/隐藏状态和层级 |
| **命名规范** | 通常包含 `pose` 关键字 |

---

### 6. 动作文件 (motion3.json) - 可选

| 属性 | 说明 |
|------|------|
| **文件扩展名** | `.motion3.json` |
| **作用** | 定义模型的动画序列 |
| **命名规范** | 通常放在 `motions/` 子目录中 |

**JSON 结构示例：**

```json
{
  "Version": 3,
  "Meta": {
    "Duration": 3.0,
    "Fps": 30,
    "Loop": true,
    "FadeInTime": 0.5,
    "FadeOutTime": 0.5,
    "CurveCount": 10,
    "TotalSegmentCount": 100,
    "TotalPointCount": 200
  },
  "Curves": [
    {
      "Target": "Parameter",
      "Id": "ParamAngleX",
      "Segments": [0, 0, 1, 1, 0, 3, 0]
    }
  ]
}
```

**解析过程作用：**

- 定义参数随时间的变化曲线
- 支持淡入淡出效果

---

### 7. 表情文件 (exp3.json) - 可选

| 属性 | 说明 |
|------|------|
| **文件扩展名** | `.exp3.json` |
| **作用** | 定义表情状态 |
| **命名规范** | 通常放在 `expressions/` 子目录中 |

---

### 8. 音效文件 - 可选

| 属性 | 说明 |
|------|------|
| **文件扩展名** | `.wav` / `.mp3` |
| **作用** | 动作播放时同步播放的音效 |
| **命名规范** | 通常放在 `sounds/` 子目录中 |

---

## 三、代码解析流程

### 解析步骤：

1. **读取 ZIP 文件** - 使用 JSZip 解压 ZIP 文件，获取所有文件路径列表

2. **查找配置文件** - 首先查找 `*.model3.json` 文件，如果找不到，则自动创建配置

3. **验证必需文件**

   - 必须有且仅有一个 `.moc3` 文件
   - 必须至少有一个 `.png` 纹理文件

4. **加载资源** - 根据 `model3.json` 中的路径加载各资源文件，将资源绑定到模型

---

## 四、无配置文件模式（自动生成配置）

如果 ZIP 包内**没有 `model3.json` 文件**，程序会自动检测文件类型并生成配置：

```typescript
// 自动检测文件类型并生成配置
const settings = new Cubism4ModelSettings({
  url: `${modelName}.model3.json`,
  Version: 3,
  FileReferences: {
    Moc: mocFile,           // 自动找到的 .moc3 文件
    Textures: textures,     // 自动找到的所有 .png 文件
    Physics: physics,       // 自动找到的 physics 文件
    Pose: pose,             // 自动找到的 pose 文件
    Motions: motions.length ? {
      '': motions.map(motion => ({ File: motion }))
    } : undefined,
  },
})
```

---

## 五、文件命名规范总结

| 文件类型 | 扩展名 | 检测方式 | 是否必需 |
|----------|--------|----------|----------|
| 模型配置 | `.model3.json` | `endsWith('model3.json')` | 推荐有 |
| 模型数据 | `.moc3` | `endsWith('.moc3')` | **必需（唯一）** |
| 纹理图片 | `.png` | `endsWith('.png')` | **必需（至少1个）** |
| 物理配置 | `.physics3.json` | `includes('physics')` | 可选 |
| 姿势配置 | `.pose3.json` | `includes('pose')` | 可选 |
| 动作文件 | `.motion3.json` | `endsWith('.motion3.json')` | 可选 |
| 动作文件(旧格式) | `.mtn` | `endsWith('.mtn')` | 可选 |
| 表情文件 | `.exp3.json` | - | 可选 |
| 音效文件 | `.wav` / `.mp3` | - | 可选 |

---

## 六、最小可用 ZIP 结构

最简单的可用 Live2D 模型 ZIP 包只需包含：

```
minimal_model.zip
├── model.moc3      ← 必需：模型数据
└── texture.png     ← 必需：纹理图片
```

程序会自动生成配置文件来加载这个模型。

---

## 七、推荐的完整结构

```
recommended_model.zip
├── character.model3.json     ← 配置入口
├── character.moc3            ← 模型数据
├── textures/
│   ├── texture_00.png
│   └── texture_01.png
├── character.physics3.json   ← 物理效果
├── motions/
│   ├── idle_01.motion3.json
│   ├── idle_02.motion3.json
│   └── tap_body.motion3.json
├── expressions/
│   ├── happy.exp3.json
│   └── sad.exp3.json
└── sounds/
    └── tap.wav
```

这样的结构可以确保模型被完整加载，包含所有动画和表情功能。

---

## 八、Cubism 2.1 与 Cubism 4 的区别

| 特性 | Cubism 2.1 | Cubism 4 |
|------|------------|----------|
| 模型配置文件 | `model.json` | `model3.json` |
| 模型数据文件 | `.moc` | `.moc3` |
| 动作文件 | `.mtn` | `.motion3.json` |
| 表情文件 | `.exp.json` | `.exp3.json` |
| 物理文件 | `physics.json` | `physics3.json` |
| 姿势文件 | `pose.json` | `pose3.json` |

**注意：** 本项目主要支持 Cubism 4 格式，Cubism 2.1 格式的动作文件 (`.mtn`) 也可以被识别。

---

## 九、常见问题

### Q: 为什么模型加载失败？

A: 请检查以下几点：

1. ZIP 包内是否有且仅有一个 `.moc3` 文件
2. ZIP 包内是否至少有一个 `.png` 纹理文件
3. 如果有 `model3.json`，请检查其中的路径是否正确

### Q: 动作不播放怎么办？

A: 请检查：

1. 动作文件是否正确放在 ZIP 包内
2. `model3.json` 中的 `Motions` 配置是否正确引用了动作文件
3. 动作文件的格式是否正确 (`.motion3.json` 或 `.mtn`)

### Q: 如何添加表情？

A: 在 `model3.json` 的 `Expressions` 数组中添加表情配置：

```json
"Expressions": [
  {"Name": "表情名称", "File": "expressions/表情文件.exp3.json"}
]
```

---

## 十、技术参考

本项目使用 `pixi-live2d-display` 库进行 Live2D 模型渲染，相关技术文档：

- [pixi-live2d-display GitHub](https://github.com/guansss/pixi-live2d-display)
- [Live2D Cubism SDK 官方文档](https://docs.live2d.com/)
