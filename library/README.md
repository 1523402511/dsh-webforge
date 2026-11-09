# library/ — webforge 自带起步库

插件随包带的**最小可用素材库**，让「装完就能跑」成立：不装任何外部库，四个工具也都有真实产物可看。

目录结构刻意与真实库一致（`vendor/open-design/catalog.json` + 条目目录），所以 `plugin.mjs` 不需要为它写第二套读取逻辑。

## 内容

| 类型 | 数量 | 是什么 |
|---|---:|---|
| 网站模板 | 4 | 落地页、运营看板、文档页、定价页 |
| deck | 2 | 董事会预读（6 页）、产品发布稿（5 页） |
| 设计体系 | 2 | Paper & Ink（暖纸编辑感）、Deep Ocean（深色技术） |
| 技能 | 2 | 落地页文案提纲、演示稿提纲 |

全部为本仓库自写，**MIT**，不含任何上游素材。页面按 `D:\dsh\design-rules\WEB-DESIGN-RULES.md` 写过一遍，`page` 剖面 floor 0。

## 这不是完整库

完整库是 176 个模板 / 77 个 deck / 152 套体系 / 153 个技能（约 139 MB），来自 [OpenDesign](https://github.com/nexu-io/open-design) 的本地快照，**不随本仓库分发**。视频动效模板（`kind: motion`）不在 webforge 的收录范围内。

有完整库时插件优先用它，找不到才落到这里：

1. `WEBFORGE_LIB` 环境变量指向含 `vendor/open-design/catalog.json` 的目录
2. 与本包同级的 `eac-design-world`（同一 profile 的 `node_modules`）
3. `~/.dsh/profiles/<名字>/node_modules/eac-design-world`
4. 本目录（兜底）

## 两处说明

- **deck 的固定宽度**：每页 `width: 1280px`，会被 design-rules 的 `fixed-width` 判为 reflex。这是 16:9 deck 的必需条件（导出 PDF 要固定页尺寸），按规范第 2 节「海报式单页」处理，保留并在此说明理由。
- **文案是演示内容**：公司名、数字、引述都是示例，替换成真实材料时按规范第 5 节，不编事实、缺数据写占位符。

## 改这里的规则

- 新增条目：放目录 → 在 `vendor/open-design/catalog.json` 加一条（字段形状照现有条目）→ 跑 `node tools/check.mjs --bundled`
- 改完记得跑 `node tools/validate.mjs`，别让工具 schema 回归
