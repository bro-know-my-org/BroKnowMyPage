---
author: 假发
title: 把玻璃做清透：一次 Liquid Glass UI 试做
description: 用边缘折射、微色散和柔光实现清透玻璃，附独立 HTML 示例、核心公式与 Flutter 移植要点。
date: 2026-10-15
updated: 2026-10-15
tags:
  - UI
  - Liquid Glass
  - Flutter
  - 性能
---

<script setup lang="ts">
import { ref } from 'vue'
import { withBase } from 'vitepress'

const demoOpen = ref(false)
function toggleDemo(event: Event) {
  demoOpen.value = (event.currentTarget as HTMLDetailsElement).open
}
</script>

# 把玻璃做清透：一次 Liquid Glass UI 试做

Serein 是一次 Apple 风格玻璃 UI 试做：中心零模糊，让山景清晰透过；边缘用局部折射、细虹边和柔光表现厚度。

## 效果与示例

<details @toggle="toggleDemo">
  <summary>展开交互示例（点击后加载）</summary>
  <iframe
    v-if="demoOpen"
    :src="withBase('/demos/liquid-glass.html')"
    title="Serein 清透曲面玻璃交互示例"
    loading="lazy"
    style="display: block; width: 100%; height: 720px; margin-top: 16px; border: 0; border-radius: 12px;"
  ></iframe>
</details>

<a :href="withBase('/demos/liquid-glass.html')" target="_blank" rel="noopener noreferrer">新窗口打开</a> · <a :href="withBase('/demos/liquid-glass.html')" download="liquid-glass-demo.html">下载 HTML 源码</a>

HTML 包含 CSS、JavaScript、SVG 山景和图标，无外部依赖。默认日光、清透、曲面开启，支持切换磨砂、关闭曲面和调整染色。

「玻璃染色 38%」指滑块位置，对应表面渐变的白色 alpha 为 3.9% 和 0.65%。清透模式下，滑块只调整染色，中心模糊始终为零。文字和图标独立绘制，不参与背景处理。

## 网页实现

材质由 CSS 基础层和每个面板独立的 SVG 滤镜组成，是面向 UI 的视觉近似：

1. **边缘折射**：根据圆角矩形的边缘距离和外法线生成位移图，方向编码到红、绿通道，由 `feDisplacementMap` 采样背景。折射带宽最多 18px，向中心平滑归零；位移幅度另算。
2. **微色散**：RGB 分别使用略有差异的位移强度，再合成，形成细微的颜色错位。
3. **柔边与高光**：渐变遮罩连接边缘采样和中心背景，外侧叠加约 1.5px 的渐变虹边、内侧高光与阴影。

面板尺寸变化时重建位移图；鼠标移动只更新高光。中心模糊单独控制：

```js
function getBlur() {
  return scene.classList.contains('clear')
    ? 0
    : 5 + Number(density.value) * 0.4;
}
```

清透模式同时降低表面染色和大面积高光，保留边缘效果。参数如下。

## 参数与位移公式

以下长度以面板的逻辑坐标计算。网页使用 CSS px；Flutter 使用对应的逻辑像素，图像物理像素比在采样时另外处理。`w`、`h` 是面板尺寸，`r` 是限制在 `min(w, h) / 2` 以内的圆角，`v` 是 0 到 100 的滑块值。

| 项目 | 当前原型的计算方式 |
| --- | --- |
| 默认状态 | 日光、清透、曲面开启、`v = 38` |
| 常规面板圆角 | 26；手机主要卡片 23；其他控件见源码各自的圆角 |
| 染色基数 | `g = 0.035 + 0.0025 * v` |
| 清透表面渐变 | 145°，白色 alpha 从 `0.3 * g` 到 `0.05 * g` |
| 磨砂表面渐变 | 145°，白色 alpha 从 `g + 0.12` 到 `0.35 * g` |
| 中心模糊 sigma | 清透为 0；磨砂为 `5 + 0.4 * v` |
| 背景饱和度 | 清透 1.15；磨砂 1.55 |
| 折射带宽 | `band = min(18, min(w, h) * 0.22)` |
| 位移缩放基数 | `s = min(30, min(w, h) * 0.45)` |
| RGB 位移缩放 | 红 `s - 2`、绿 `s`、蓝 `s + 2` |
| 边缘采样输入 | 背景经过 sigma 0.65 的微模糊 |
| 绘制式虹边 | 宽 1.5、模糊 0.35、整体 opacity 0.85；颜色停靠点见源码 |

位移图保留像素中心取样和 8 位通道量化，`x`、`y` 为整数像素索引：

```js
function lensField(x, y, w, h, r) {
  const px = x + 0.5 - w / 2;
  const py = y + 0.5 - h / 2;
  const qx = Math.abs(px) - (w / 2 - r);
  const qy = Math.abs(py) - (h / 2 - r);
  const cx = Math.max(qx, 0), cy = Math.max(qy, 0);
  const len = Math.hypot(cx, cy);
  const depth = r - len - Math.min(Math.max(qx, qy), 0);
  const band = Math.min(18, Math.min(w, h) * 0.22);
  let nx = 0, ny = 0, bend = 0, mask = 0;
  if (depth >= 0 && depth < band) {
    if (len > 0) {
      nx = Math.sign(px) * cx / len;
      ny = Math.sign(py) * cy / len;
    } else if (qx > qy) nx = Math.sign(px);
    else ny = Math.sign(py);
    const t = depth / band;
    bend = Math.sin(Math.PI * t) * Math.sqrt(1 - t) * 0.72;
    const f = Math.min(1, Math.max(0, (1 - t) * 1.35));
    mask = f * f * (3 - 2 * f);
  }
  return {
    rg: [Math.round(128 + nx * bend * 127) / 255,
         Math.round(128 + ny * bend * 127) / 255],
    mask: Math.round(mask * 255) / 255,
  };
}
```

`+ 0.5` 把整数索引移到像素中心。Flutter 的 `FlutterFragCoord()` 已提供连续局部坐标，应直接用 `local - uPanelSize / 2`。

各通道采样位置为 `localPosition + channelScale * (rg - 0.5)`，合成为 `rim` 后，按 `result = rim * mask + center * (1 - mask)` 混合。`center` 在清透时取清晰背景，磨砂时取模糊背景。

HTML 用 `in` / `out` 分离区域，再以 arithmetic 的 `k2 = 1`、`k3 = 1` 相加，避免羽化处重复叠加 alpha；透明输入须保持预乘 alpha 一致。之后处理饱和度、表面染色、柔光和轮廓，最上层绘制文字与控件。

## Flutter 移植要点

Flutter 尚未实现，以下是方案，没有真机性能数据。基础层可用 `ClipRRect`、`BackdropFilter` 和透明渐变，高光与轮廓用 `CustomPainter`；局部折射和 RGB 位移交给片元着色器。背景输入有两条路线。

### 引擎提供背景

`ui.ImageFilter.shader(shader)` 可配合 `BackdropFilter` 过滤已绘制的背景，要求 Impeller；其他后端会抛出 `UnsupportedError`。SDK 需包含相关 API，并检查 `ui.ImageFilter.isShaderFilterSupported`。

第一个浮点 uniform 必须是 `vec2`（输入纹理尺寸），第一个 `sampler2D` 是输入图像，均由引擎填写。使用 `FlutterFragCoord()`，在 `IMPELLER_TARGET_OPENGLES` 下按官方约定翻转 UV 的 Y 轴。

外层用 `ClipRRect` 裁切。输入纹理的尺寸、原点与面板局部坐标需在目标后端验证，不能直接把纹理尺寸当作面板尺寸。

### 应用提供背景纹理

固定山景适合先绘制成纹理，再供多个面板共享。通过 `FragmentProgram.fromAsset()` 加载 shader，`setImageSampler()` 传入 `ui.Image`，由 `CustomPainter` 绘制；资源登记在 `pubspec.yaml` 的 `flutter.shaders` 下。

这条路线的输入全部由应用填写。三个 sampler 覆盖完整场景，共用尺寸与坐标映射：

```glsl
#include <flutter/runtime_effect.glsl>
uniform vec2 uSceneSize;    // float 0、1：整幅场景的逻辑宽高
uniform vec2 uPanelOrigin; // float 2、3：面板左上角在场景中的逻辑坐标
uniform vec2 uPanelSize;   // float 4、5：面板的逻辑宽高
uniform float uRadius;    // float 6：圆角
uniform float uSaturation;// float 7：1.15 或 1.55
uniform float uFrostMix;  // float 8：清透 0，磨砂 1
uniform sampler2D uSharp; // sampler 0：清晰背景
uniform sampler2D uFrost; // sampler 1：按当前 sigma 预模糊的背景
uniform sampler2D uRim;   // sampler 2：sigma 0.65 的边缘采样背景
out vec4 fragColor;
```

shader 主体按前面的位移公式、三通道采样和遮罩合成补齐。`setFloat()` 按注释中的索引赋值，sampler 独立绑定。共享 `FragmentProgram`，各面板使用独立的 `FragmentShader`，防止 uniform 相互覆盖。

Canvas 平移到面板左上角，在 `Rect.fromLTWH(0, 0, w, h)` 内绘制，令 `FlutterFragCoord().xy` 对应面板局部逻辑坐标：

```glsl
vec2 local = FlutterFragCoord().xy;
vec2 uv = (uPanelOrigin + local) / uSceneSize;
```

边缘采样先给 `local` 加对应通道位移，UV 按纹理边界钳位。背景若用 `BoxFit.cover` 或裁切，显示和采样须共用变换。

**背景纹理只包含玻璃后面的内容。** 用 `RepaintBoundary.toImage(pixelRatio: dpr)` 时，等待背景层绘制完成再采集。纹理尺寸约为逻辑尺寸乘以 DPR；UV 已归一化，不再乘 DPR，模糊 sigma 则须换算到图像像素尺度。

饱和度、渐变、阴影和色彩空间需与网页做视觉对齐。轮廓颜色和样式数值见 HTML 的 `.glass`、`.glass:before`、`.glass:after` 和 `.clear`。

## 静态缓存

固定背景下，可缓存折射、色散和柔边合成后的材质图像，文字与控件另行叠加。背景、面板位置、尺寸、DPR 或材质参数改变时使缓存失效；多个面板共享背景纹理，及时释放旧图像，滑块更新可合并处理。

`RepaintBoundary` 只隔离重绘，图像缓存及失效逻辑仍需单独实现。背景滚动、视频和跟手高光都会引起更新；帧耗时与内存需在目标设备的 profile 模式实测。

## 已验证范围

原型已在 Chromium 预览环境检查：

- 手机与桌面宽度下的布局、清透/磨砂切换、曲面开关和染色滑块。
- 清透模式染色拉满后，中心模糊仍为零。
- 换成黑白网格并关闭染色、高光与轮廓装饰后，曲面开关只改变边缘带内的采样，中心保持清晰。

其他浏览器需实际检查 `backdrop-filter: url(#filter)` 的渲染；`CSS.supports()` 通过只代表声明被接受。可用同样的网格对比确认折射，未支持时降级为基础透明面板。Flutter 版还需检查不同 DPR 下的背景对齐、缓存失效及实际性能。

## 相关文档

- [Flutter：片元着色器](https://docs.flutter.dev/ui/design/graphics/fragment-shaders)
- [Flutter：BackdropFilter](https://api.flutter.dev/flutter/widgets/BackdropFilter-class.html)
- [Flutter：ImageFilter.shader 的后端要求与 uniform 约定](https://api.flutter.dev/flutter/dart-ui/ImageFilter/ImageFilter.shader.html)
- [Flutter：渲染性能](https://docs.flutter.dev/perf/rendering-performance)
