## Context

仓库当前已实现 3 个 workspace 按钮与基础配置（emoji/hover 文案/绑定列表），并且提供了右键菜单与设置页的绑定入口。
但现有语义是「workspace 激活时隐藏绑定项（exclude）」，与用户的直觉语义「workspace 激活时显示绑定项（include）」相反，导致：

- 右键 “Add to Workspace” 与实际效果不一致（用户期望“加入=可见”，实际“加入=隐藏”）。
- 用户难以把 workspace 当作稳定的“视图切换”来使用。
- 绑定为空时行为不清晰（用户无法确认是没配置还是配置错误）。

本变更将 workspace 定义为 “include/whitelist 视图”，并补齐一个可批量管理与清理的二级界面，减少配置与迁移成本。

## Goals / Non-Goals

**Goals:**
- workspace 按钮语义变更为 include/whitelist：激活后仅显示该 workspace 的绑定内容。
- 支持同一文件/文件夹同时属于多个 workspace。
- 空 workspace 激活后显示空视图（不显示任何文件/文件夹）。
- 提供两条配置路径：
  - 右键文件/文件夹（支持多选）快速加入/移除某 workspace；
  - 设置页打开二级管理界面，支持多选/全选、批量移除、批量添加与清理无效路径。
- 保持现有 emoji/hover 文案配置与 3 个固定 workspace 的约束。

**Non-Goals:**
- 支持任意数量 workspace、复杂规则编辑器或跨 vault 同步。
- 引入新的索引系统或重构 Obsidian 文件树渲染流程。
- 在本变更中引入“基于标签/正则/通配符的 include 规则”（本次优先以路径成员为主）。

## Decisions

### 1) 术语与语义

- 将现有 “workspace focus” 视为“workspace 视图切换（view toggle）”。
- **include/whitelist 语义**：workspace 绑定的是“可见成员（文件/文件夹路径）”，激活时显示这些成员；取消激活回到默认视图。

### 2) 数据模型

- workspace 绑定以 **路径成员** 作为主模型（文件路径、文件夹路径），并做规范化（去首尾空格、去末尾 `/`）。
- 允许同一路径同时存在于多个 workspace 的绑定列表中。
- 为升级/迁移提供明确策略（见 Migration Plan）：避免旧数据导致升级后 workspace 视图永久为空。

### 3) 可见性推导（文件树最小可导航子集）

文件浏览器是树形结构。仅“显示文件”不够，需要让用户能导航到该文件。

**可见性规则：**
- 若某文件路径被 workspace include，则该文件可见；
- 若某文件夹路径被 workspace include，则该文件夹及其整个子树可见；
- 对任何可见项，其所有祖先文件夹必须可见（保证树可导航）；
- 若 workspace include 列表为空，则所有文件/文件夹均不可见（空视图）。

**实现策略（概念层面）：**
- 将 include 列表拆成 `includeFiles` 与 `includeFolders`（文件夹按 `folderPath + "/"` 形式存储便于前缀判断）。
- 判断某个节点（PathVirtualElement）是否可见时：
  - 精确匹配 include file/folder；
  - 或者作为 include item 的祖先文件夹；
  - 或者位于某 include folder 的子树中。
- 为性能，避免对每个节点重复做 O(N) 字符串扫描：可以在一次 requestSort 周期内预计算/缓存 include 结构（例如 set + 前缀数组），并尽量只在 workspace 激活或绑定变更时刷新。

### 4) 交互与入口

- 工具条按钮保持 3 个且互斥激活；再次点击同一按钮即取消激活。
- 右键文件/文件夹与多选菜单提供 “Add to / Remove from Workspace 1~3”。
  - 对于已在某 workspace 中的路径，显示为 Remove；未包含则为 Add。
- 设置页保留每个 workspace 的 emoji 与 hover 文案编辑，同时新增一个 “Manage…” 按钮打开二级管理界面。

### 5) 二级管理/清理界面（Modal）

最小可用方案（满足多选/全选、批量移除/添加、清理）：
- 支持按 workspace 查看其绑定成员列表（显示路径、类型、是否存在）。
- 列表支持多选/全选：
  - 批量移除选中项；
  - 批量移动/复制到另一个 workspace（可选，若实现成本低）。
- 支持添加：
  - 通过路径搜索（PathSuggest）选择文件/文件夹并加入某 workspace。
- 支持清理：
  - 一键移除“不存在/已删除/已重命名且未迁移”的路径；
  - 去重（同 workspace 内重复条目）。

## Risks / Trade-offs

- [大 vault 性能] → include 可见性判断若每次排序都扫描全部绑定，可能造成卡顿；通过 set/前缀缓存与仅在需要时刷新降低开销。
- [树可导航性] → 只显示叶子文件会让用户“看见文件但无法展开到它”；必须显式保留祖先文件夹。
- [升级破坏性] → 旧 exclude 语义的配置可能导致 include 视图为空；提供迁移与二级管理界面以降低成本，并在升级后提示用户检查绑定。
- [与其他过滤功能叠加] → hide filters / focus mode 等功能与 workspace view 叠加可能导致“看不到东西”；在 UI 文案与空状态提示中明确当前视图与可用操作。

## Migration Plan

- 本变更为 **BREAKING** 行为变化。
- 迁移目标：将旧 workspace 绑定列表尽可能转换为路径成员，并避免升级后 workspace 视图永久为空。
- 建议策略：
  1. 将旧绑定条目中“能匹配到 vault 现存路径”的部分迁移为 include paths；
  2. 其余无法识别的条目移动到“Legacy/Unresolved”列表（仅用于展示与清理，不参与可见性）；
  3. 在设置页与管理 modal 中提供“清理无效条目”入口。

## Open Questions

- **Focus Mode 互斥：** 当用户激活任意 workspace 视图时，系统会自动解除 Focus Mode（`focusMode.active = false`），避免双重过滤导致用户误以为内容丢失。
- **空 workspace 提示：** 不额外提供 toast/占位提示；空列表即为空 workspace 的自然反馈，用户可再次点击按钮恢复默认视图。
