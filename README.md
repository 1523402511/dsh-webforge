# dsh-webforge

把本机已有的网页素材库变成 DSH 工具：搜库、读设计体系、拼初稿、把 deck 打成 PDF。

**它不打包任何素材**——运行时只读你本机 `eac-design-world` 里的 `vendor/open-design`。所以这个仓库只有几百行代码。

## 安装

```bash
# 从本仓库的压缩包装（不需要 git clone）
dsh plugin --profile <你的profile> add https://codeload.github.com/<owner>/dsh-webforge/tar.gz/refs/heads/main
```

或在 DSH 的插件面板里填这个 tarball 地址。装完重启一次 DSH。

> `dsh plugin` 不能管理 Electron 独占的 `desktop` profile；那种情况下请用应用内的插件面板。

## 它给的是什么

| 工具 | 作用 |
|---|---|
| `webforge_search` | 搜 176 个网站模板 / 81 个 deck 演示稿 / 152 套设计体系 / 169 个技能 / 94 个动效参考 |
| `webforge_read` | 读某一条的正文：模板入口 HTML、体系 `tokens.css` + `DESIGN.md`、技能 `SKILL.md` |
| `webforge_build` | 模板 + 体系 + 标题 → 拼一份能打开的初稿，落盘并返回「改了什么、跳过了什么」 |
| `webforge_export` | deck / 页面按指定尺寸打 PDF（默认 1280×720，16:9），返回页数与体积 |

外加一段系统提示：用户说「做个网页 / 官网 / 落地页 / 看板 / PPT / 演示稿」时，先搜库再动手。

## 数据从哪来

只读 `eac-design-world` 的 `vendor/open-design/catalog.json` 与其引用的文件。不复制、不改写源库；产物写到 `D:\dsh\网站\<标题>-<时间>\`。

定位顺序：`WEBFORGE_LIB` 环境变量 → 本包同级目录的 `eac-design-world` → `~/.dsh/profiles/desktop/node_modules/eac-design-world`。

## 诚实边界

`webforge_build` 产出的是**版式 + 体系的初稿**，不是成品：

- 只换 `<title>` / `meta description` / 首个 `<h1>`，注入 `tokens.css`，再做有护栏的保守换色
- 不改结构、不写文案；模板自带的示例数据仍在
- 换色是启发式的：明暗极性相反、对比度不过关、只出现一次的反白，都会跳过并在 `patches` 里写明原因
- `webforge_export` 转不出可编辑的 `.pptx`：HTML deck 里没有 PowerPoint 的文本框/表格语义，要可编辑只能重建

## 自检

```bash
node tools/check.mjs
```

用假 ctx 注册 4 个工具，实测搜索 → 读取 → 拼装 → 导出四条链路，产物写到临时目录后自动清理。

## 许可

本仓库代码 MIT。运行时读取的素材库归各上游项目所有（`nexu-io/open-design` 为 Apache-2.0，条目逐条标注 MIT / Apache-2.0 / CC-BY-4.0），本仓库不再分发它们。

## 卸载

从 profile 的依赖与 bundle 列表里移除本包，或 `dsh plugin --profile <你的profile> remove dsh-webforge`，重启即可。插件没有常驻进程、不联网。
