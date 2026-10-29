# AIPA Origin

[English](README.md) · **简体中文**

**版本 1.0.2 · Apache-2.0**

AIPA（Artificial Intelligence Personal Agent，人工智能个人智能体）是一个以本地文件为基础的个人智能体框架。个人画像、偏好、记忆、技能、项目和活动记录保存在你自己的私有实例中，由连接的模型宿主在不同会话之间使用。

本仓库维护框架源码。安装和日常使用请从 [Personal](https://github.com/StriveJ/artificial-intelligence-personal-agent) 开始；需要后台常驻、网页访问和设备间同步时，单独部署 [Hub](https://github.com/StriveJ/artificial-intelligence-personal-agent-hub)。

## 三个仓库的职责

| 仓库 | 用途 |
|---|---|
| [Origin](https://github.com/StriveJ/artificial-intelligence-origin-agent) | Core 源码、空白模板、测试、构建和发行工具 |
| [Personal](https://github.com/StriveJ/artificial-intelligence-personal-agent) | 从 Origin 的 product/ 生成的公开安装与更新产物 |
| [Hub](https://github.com/StriveJ/artificial-intelligence-personal-agent-hub) | 主/从服务、网页入口、调度、模型执行器和实例 Git 同步 |

个人实例必须使用独立目录和私有仓库。公开模板不包含个人记忆、对话、凭据或服务配置。

## 主要能力

- 用个人画像、价值观和偏好指导模型协作。
- 文件记忆检索、项目范围、确认状态、有效期、替代与撤回规则。
- 可复用技能、导师、项目上下文、会话记录、检查点和报告。
- 具有可信来源校验、变更检测、预览、恢复和回滚的 Core 更新。
- 可选 Hub 网页对话、笔记、调度和设备间 Git 同步。
- 代码和机械接口使用英文；模型输入输出遵循用户语言偏好，个人正文保留原语言。

AIPA 不附带托管模型账号。模型、外部检索、通知和远端同步需要独立配置与授权。Core 仅使用 Node 内置和本地模块；Hub 单独声明依赖。

## 开发与测试

使用 Node.js 24 和 Git 2.31 或更新版本。Windows 建议使用较短的源码目录，避免嵌套测试仓库超过路径长度限制。

```bash
git clone https://github.com/StriveJ/artificial-intelligence-origin-agent.git
cd artificial-intelligence-origin-agent
node studio/scripts/aipa-check.mjs --mode quick
node studio/scripts/aipa-check.mjs --mode all
```

Origin 无需 npm install。默认测试使用隔离的合成实例和本地远端，不调用付费模型。真实模型评测需要另外明确授权。

## 构建 Personal

在 product/ 修改源码并提交后，组装到专用产物目录：

```bash
node studio/scripts/aipa-assemble-origin.mjs --src . --dest /absolute/path/to/personal-output
node studio/scripts/aipa-validate-origin.mjs --origin /absolute/path/to/personal-output --strict
node studio/scripts/aipa-origin-abstract-check.mjs --dir /absolute/path/to/personal-output
```

**组装会替换目标目录中除 .git 之外的内容，绝不能指向个人实例或其他工作目录。** 产物包含源码溯源与文件摘要。Personal 的修改应回到 Origin 的 product/ 源码中完成。

Origin master 对应稳定版和 Personal master；Origin dev 对应测试版和 Personal beta。发布、版本标签、签名和生产部署分别执行，已发布产物、摘要和标签不可覆盖。

## 文档与贡献

- [Personal 安装与更新](product/README_CN.md)
- [贡献流程](CONTRIBUTING.md)与[实例贡献指南](docs/instance-to-origin-contribution.md)
- [框架](product/framework.md)、[边界](product/core-space/CONSTRAINTS.md)与[跨宿主契约](product/core-space/shared-contracts.md)
- [构建约定](studio/CLAUDE.md)、[质量门与 CI](studio/ci/README.md)与[验收工具](lab/README.md)
- [维护者](MAINTAINERS.md)与[代码负责人](.github/CODEOWNERS)

PR 面向 dev。问题、复现和测试只能使用合成数据，不要提交真实画像、对话、密钥、运行目录或私有配置。维护者名单不等于平台权限，仓库权限与分支保护需要单独配置。

## 联系我

如果你有什么建议与想法，可以发邮箱联系我：

- [1905212905@qq.com](mailto:1905212905@qq.com)
- [strivejun@gmail.com](mailto:strivejun@gmail.com)

## 许可证

代码与文档统一采用 [Apache-2.0](LICENSE)，包含第 3 节明确的贡献者专利授权及其条件。第三方组件保留各自许可证，个人实例数据不会因使用 AIPA 自动适用本项目的开源许可证。
