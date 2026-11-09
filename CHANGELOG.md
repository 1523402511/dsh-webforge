# Changelog

本文件记录用户可见的变化。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号用 [SemVer](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.3.0] - 2026-11-09

### 移除

- **视频动效素材全部移出**：`webforge_search` 不再收录 `kind: motion`（79 条 OpenDesign 动效模板 + 15 条 MG 风格 demo，共 94 条）。这个插件的产出是网页与 deck，视频素材归视频工具，混在一起会让人误以为能拿它做片子。库数量随之变为 176 模板 / 77 deck / 152 体系 / 153 技能。
- **技能里 16 条视频生产类一并摘掉**：Sora、Kling O3、Fal lip-sync、Fal video edit、Venice video、视频下载器、HyperFrames 视频模板、两个 `*-video-template`、YouTube clipper、chat motion overlay、After Hours HyperFrames 模板、motion-design（15 秒 motion film + MP4 交付）、Remotion（React 编程生成视频）、huashu-art-motion（艺术动画与分镜解说）。保留 `animate`（界面动效）、`oil-motion`（滚动/指针/拖动驱动的网页动效）、`motion-lab`、`emilkowalski-motion`，以及 `fal-generate`（能出图）。
- `webforge_search` 的 `kind` 枚举去掉 `motion`；`webforge_read` / `webforge_export` 不再接受 motion 条目；搜索摘要与系统提示里的「94 个动效参考」一并删除。

### 变更

- 版本号 0.3.0。只收网页（website）与 deck（deck）；`document` / `image` / `prompt` / `motion` 四类本来就不收，现在 motion 也明确了。

## [0.2.0] - 2026-11-09

### 新增

- **包内起步库**（`library/`）：4 个网站模板、2 个 deck、2 套设计体系、2 个技能，全部本仓库自写、MIT。装完不依赖任何外部素材就能跑通四个工具。
- `tools/check.mjs --bundled`：用起步库自检，CI 与干净环境用这条。
- `tools/check.mjs --no-export`：没有 Edge/Chrome 的机器跳过 PDF 那一步，其余链路照跑。
- `.github/workflows/ci.yml`：Ubuntu 跑 schema + 起步库全链路（不导出）；Windows 跑完整链路并核对 PDF 页数。
- 本文件。

### 变更

- `findLibrary()` 增加两级探测：扫描 `~/.dsh/profiles/*/node_modules/eac-design-world`（不再写死 `desktop` profile），并以包内 `library/` 兜底。
- 导出浏览器改为跨平台探测：Windows 默认安装位置、macOS `/Applications/*.app`、Linux 常见路径，最后扫 `PATH`；仍可用 `WF_BROWSER` 指定。
- 默认输出目录从写死的 `D:\dsh\网站` 改为 `~/webforge/网站`，可用 `outDir` 或 `WEBFORGE_OUT` 覆盖。装了 `cordis.patch.yml` 的老用户仍在原目录。
- 系统提示不再写死 `D:\dsh\design-rules\WEB-DESIGN-RULES.md`，改为「若工作区存在网页设计规范则按其 page 剖面检查」。
- 体积描述更正：完整库的 deck 是 **77** 个可导出（catalog 里 81 条，4 条没有入口 HTML），不再写 81。

### 修复

- deck 页数统计会误把注释和样式里提到的 `<section>` 算成一页，导致「PDF 页数 ≠ section 数」的假告警。现在先剥离注释、`<style>`、`<script>` 再计数。
- 工具描述里的输出路径、库数量与实际行为不一致。

## [0.1.0] - 2026-11-09

### 新增

- 四个工具：`webforge_search`、`webforge_read`、`webforge_build`、`webforge_export`。
- 只读 `eac-design-world` 的 `vendor/open-design` 索引，零依赖、不联网。
- `tools/validate.mjs`：拦 provider 会拒收的 schema 写法（属性级 `required: true` 之类）。
- `tools/check.mjs`：用假 ctx 跑通搜索 → 读取 → 拼初稿 → 导出。
