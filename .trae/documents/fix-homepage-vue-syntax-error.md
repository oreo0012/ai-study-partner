# 修复HomePage.vue语法错误计划

## 问题分析

### 错误信息
```
[plugin:vite:vue] illegal '/' in tags
D:/AiPorject/AiStudyPartner/apps/web/src/pages/HomePage.vue:45:65
```

### 根本原因
在Vue模板中使用UnoCSS属性模式时，`bg-white/80` 这样的类名包含 `/` 字符，在属性值中直接使用会导致Vue编译器解析错误。

**问题代码位置**：
- 第45行：`absolute inset-0 flex items-center justify-center bg-white/80 z-50`
- 第112行：`w-full md:w-96 lg:w-[420px]` 中的 `[420px]` 也可能有问题

### 解决方案
将UnoCSS属性模式改为标准的class绑定方式，避免在属性值中使用特殊字符。

---

## 修复步骤

### 步骤1：修复HomePage.vue中的非法字符

**修改前**：
```vue
<div
  v-if="isLoading"
  class="loading-overlay"
  absolute inset-0 flex items-center justify-center bg-white/80 z-50
>
```

**修改后**：
```vue
<div
  v-if="isLoading"
  class="loading-overlay absolute inset-0 flex items-center justify-center bg-white/80 z-50"
>
```

### 步骤2：修复其他可能的问题位置

检查并修复以下行：
- 第57行：`absolute inset-0 flex items-center justify-center z-50`
- 第112行：`w-full md:w-96 lg:w-[420px] h-full bg-white/80 backdrop-blur-sm shadow-lg`

### 步骤3：验证修复

1. 保存文件后检查开发服务器是否自动重新编译
2. 访问页面确认无错误
3. 检查控制台无报错

---

## 文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `apps/web/src/pages/HomePage.vue` | 将UnoCSS属性模式改为class绑定 |

---

## 预期结果

1. Vue编译错误消失
2. 页面正常加载
3. 控制台无500错误
