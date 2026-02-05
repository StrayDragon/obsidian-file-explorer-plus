## ADDED Requirements

### Requirement: Workspace toggle entry points
系统 MUST 在文件浏览器区域提供 3 个工作区切换按钮。按钮 MUST 显示可配置的 emoji，并在 hover 时显示可配置的提示文案。按钮组在同一时刻至多一个处于激活状态。

#### Scenario: 渲染入口
- **WHEN** 用户打开文件浏览器视图
- **THEN** 系统显示 3 个工作区按钮，并为每个按钮提供 emoji 展示与 hover 提示

### Requirement: Workspace configuration and persistence
系统 MUST 允许用户为每个工作区配置 emoji、hover 文案与绑定的文件/文件夹路径成员，并在重启后保持这些设置不丢失。

#### Scenario: 持久化配置
- **WHEN** 用户在设置中更新任意工作区的 emoji、hover 文案或绑定成员并重启应用
- **THEN** 系统仍然使用更新后的配置渲染按钮与工作区视图

### Requirement: Activate workspace include view
当用户点击未激活的工作区按钮时，系统 MUST 切换到该工作区的 include/whitelist 视图：文件浏览器仅显示该工作区绑定的文件/文件夹成员，并保留必要的父目录以保证树可导航。若 Focus Mode 处于激活状态，系统 MUST 自动解除 Focus Mode。

#### Scenario: 激活工作区视图
- **WHEN** 用户点击未激活的工作区按钮
- **THEN** 文件浏览器仅显示该工作区绑定的成员及其父目录，并标记该工作区为激活状态

#### Scenario: 激活时解除 Focus Mode
- **WHEN** Focus Mode 处于激活状态且用户点击未激活的工作区按钮
- **THEN** 系统解除 Focus Mode 并切换到该工作区的 include/whitelist 视图

### Requirement: Deactivate workspace include view
当用户再次点击已激活的工作区按钮时，系统 MUST 取消激活并恢复到默认视图（展示所有文件/文件夹，受其他全局过滤功能影响的部分仍按其规则显示/隐藏）。

#### Scenario: 取消激活
- **WHEN** 用户点击已激活的工作区按钮
- **THEN** 系统恢复到默认视图并清除激活标记

### Requirement: Switch between workspaces
当已有激活工作区且用户点击另一个工作区按钮时，系统 MUST 切换到新工作区的 include/whitelist 视图，并仅标记新工作区为激活。

#### Scenario: 切换工作区
- **WHEN** 已有工作区处于激活状态且用户点击另一个工作区按钮
- **THEN** 系统展示新工作区的成员视图并仅标记新工作区为激活

### Requirement: Empty workspace view
当某工作区没有绑定任何文件/文件夹成员时，激活该工作区 MUST 显示空视图（不显示任何文件/文件夹）。

#### Scenario: 空工作区
- **WHEN** 用户激活一个未绑定任何成员的工作区
- **THEN** 文件浏览器显示空的文件/文件夹列表

### Requirement: Folder membership includes subtree
当用户将某个文件夹加入某工作区后，激活该工作区时系统 MUST 显示该文件夹以及该文件夹的整个子树（子文件夹与文件）。

#### Scenario: 文件夹子树可见
- **WHEN** 用户将某文件夹加入 Workspace 1 并激活 Workspace 1
- **THEN** 文件浏览器显示该文件夹及其所有子文件夹与文件

### Requirement: Items may belong to multiple workspaces
系统 MUST 允许同一文件/文件夹同时加入多个工作区；激活任意包含该成员的工作区时，该成员 MUST 可见。

#### Scenario: 多工作区成员
- **WHEN** 用户将同一文件加入 Workspace 1 与 Workspace 2
- **THEN** 激活 Workspace 1 或 Workspace 2 时该文件均可见

### Requirement: Workspace membership via context menu
系统 MUST 在文件/文件夹右键菜单中提供工作区成员管理入口，允许用户将当前文件/文件夹加入或移出任意一个工作区；在多选菜单中也 MUST 支持相同操作。

#### Scenario: 右键加入并可见
- **WHEN** 用户在文件浏览器中右键某文件并选择 “Add to Workspace 1”，随后激活 Workspace 1
- **THEN** 该文件在 Workspace 1 视图中可见

#### Scenario: 右键移除并不可见
- **WHEN** 用户将某文件已加入 Workspace 1，随后右键选择 “Remove from Workspace 1”，再激活 Workspace 1
- **THEN** 该文件在 Workspace 1 视图中不可见

### Requirement: Workspace membership management UI
系统 MUST 在设置界面提供一个二级管理界面（例如 modal），用于集中管理工作区成员。该界面 MUST 支持多选/全选与批量移除，并提供向任意工作区批量添加成员的方式。

#### Scenario: 批量移除
- **WHEN** 用户在管理界面中全选多个成员并执行批量移除
- **THEN** 这些成员从对应工作区中移除且保存持久化

#### Scenario: 批量添加
- **WHEN** 用户在管理界面中通过路径选择器添加多个成员到 Workspace 2 并保存
- **THEN** 激活 Workspace 2 时这些成员可见

### Requirement: Cleanup invalid membership
管理界面 MUST 提供清理能力：识别并移除无效/不存在的路径成员，避免成员列表长期积累脏数据。

#### Scenario: 清理无效路径
- **WHEN** 某工作区成员列表中存在已删除/不存在的路径且用户执行清理操作
- **THEN** 系统移除这些无效条目并保存更新后的成员列表
