## Why

当前 “Workspace focus / 工作区” 的实现语义更接近「在某个 workspace 激活时 *隐藏* 一组东西」，而用户更直觉的心智模型是：
「把文件/文件夹加入 Workspace 1 → 点击 Workspace 1 时只显示这些内容」。

当语义与操作（右键 Add/Remove）不一致时，用户会难以预测结果，也无法把 workspace 当作真正的“视图/工作区”来使用。

## What Changes

- **BREAKING**：将 workspace 从“隐藏列表（exclude）”切换为“显示列表（include/whitelist）”语义：激活某个 workspace 时，文件浏览器仅显示该 workspace 绑定的文件/文件夹（并保留必要的父目录用于导航）；再次点击取消激活则回到默认视图。
- 默认情况下（用户未向某 workspace 添加任何内容），点击该 workspace 将显示空的文件/文件夹列表（空工作区视图）。
- 增强入口与配置：
  - 右键文件/文件夹（以及多选）提供 “Add to / Remove from Workspace 1~3” 的成员管理。
  - 设置页提供一个二级“管理/清理”界面（Modal），支持多选/全选、批量移除、批量添加与清理无效路径。
- 保持现有 3 个 workspace 按钮、emoji 与 hover 文案配置不变（仅调整其语义与绑定内容）。

## Capabilities

### New Capabilities
- `workspace-focus-group-toggle`: 3 个可配置工作区按钮 + include/whitelist 视图语义 + 成员管理与清理界面。

### Modified Capabilities

## Impact

- 逻辑：文件浏览器过滤流程从 “workspace hide rules” 变为 “workspace include view”，并需要处理父目录/子树可见性推导与空工作区行为。
- 设置与持久化：workspace 绑定数据结构将从“规则/名称”过渡到“文件/文件夹路径成员”；需要迁移与清理能力以避免升级后出现空视图/不可恢复状态。
- UI：设置页新增管理入口（modal），右键菜单新增 workspace 成员管理操作，按钮提示文案与激活态保持一致性。
