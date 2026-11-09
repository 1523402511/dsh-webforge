# Paper & Ink

暖纸底、墨黑字、赭石强调。适合长文阅读、报告、编辑类页面——不是给数据看板用的。

## 气质

- 底色像未漂白的纸，不用纯白铺满整屏
- 标题用衬线（Noto Serif SC），正文用无衬线，靠字族对比建立层级
- 强调色只出现在链接、序号、下划线，面积不超过 5%
- 不画渐变的装饰块；分隔用 1px 线，不用阴影堆叠

## 色板

| token | 值 | 用途 |
|---|---|---|
| `--bg` | `#FBF9F4` | 页面底色 |
| `--surface` | `#FFFFFF` | 卡片、输入框 |
| `--surface-warm` | `#F1E6D6` | 引用块、强调区域 |
| `--fg` | `#14161A` | 正文 |
| `--fg-muted` | `#5A5F66` | 辅助文字（对底色 6.5:1） |
| `--accent` | `#B4552D` | 链接、序号、强调（对白色 5.3:1） |
| `--border` | `#E3DED2` | 分隔线、卡片描边 |

## 字体

- 标题：`"Noto Serif SC", Georgia, serif`，600
- 正文：`"Geist", "Noto Sans SC", system-ui, sans-serif`，400，16px / 1.75
- 代码：等宽栈，14px

## 排版

- 正文行长 640–840px（32–42 个全角字）
- 段落间距 24px，不用首行缩进
- 标题与正文之间 8–12px，区块之间 64–96px

## 用起来

```css
body { background: var(--bg); color: var(--fg); font: 400 16px/1.75 var(--font-sans); }
h1, h2 { font-family: var(--font-serif); font-weight: 600; line-height: 1.2; }
a { color: var(--accent); }
```

## 不适合

后台看板、需要高信息密度的表格页、深色模式的夜间界面。
