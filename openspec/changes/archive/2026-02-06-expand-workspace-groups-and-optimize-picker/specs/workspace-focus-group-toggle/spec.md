## MODIFIED Requirements

### Requirement: Workspace toggle entry points
系统 MUST 在文件浏览器区域提供 3 个快捷工作区按钮。按钮 MUST 显示可配置的 emoji，并在 hover 时显示可配置的提示文案。按钮组在同一时刻至多一个处于激活状态。

当已配置工作区总数超过 3 个时，系统 MUST 在快捷按钮右侧提供 `…` 溢出按钮。点击后 MUST 展示全部工作区并允许直接激活任意一个。

#### Scenario: 渲染快捷入口
- **WHEN** 用户打开文件浏览器视图且工作区总数大于等于 3
- **THEN** 系统显示 3 个工作区快捷按钮，并为每个按钮提供 emoji 展示与 hover 提示

#### Scenario: 渲染溢出入口
- **WHEN** 用户配置了超过 3 个工作区
- **THEN** 系统在快捷按钮右侧显示 `…` 按钮，点击后显示全部工作区列表

### Requirement: Workspace configuration and persistence
系统 MUST 允许用户配置多个工作区（不少于 1 个），并为每个工作区配置 emoji、hover 文案与绑定的文件/文件夹路径成员。系统 MUST 支持新增、删除、重排工作区并在重启后保持这些设置不丢失。

#### Scenario: 持久化多工作区配置
- **WHEN** 用户在设置中新增第 4 个工作区并配置其 emoji、hover 文案与成员后重启应用
- **THEN** 系统仍然保留该工作区并按保存后的顺序和配置渲染

#### Scenario: 删除工作区后保持一致
- **WHEN** 用户删除一个非激活工作区并保存设置
- **THEN** 系统从工具栏与管理界面移除该工作区且其他工作区成员配置保持不变

### Requirement: Activate workspace include view
当用户点击未激活的工作区按钮（含 `…` 列表中的工作区）时，系统 MUST 切换到该工作区的 include/whitelist 视图：文件浏览器仅显示该工作区绑定的文件/文件夹成员，并保留必要的父目录以保证树可导航。若 Focus Mode 处于激活状态，系统 MUST 自动解除 Focus Mode。

激活成功后，系统 MUST 将该工作区提升到“最近使用优先”的展示顺序前列。

#### Scenario: 从溢出列表激活工作区
- **WHEN** 用户通过 `…` 列表点击一个未激活工作区
- **THEN** 文件浏览器切换到该工作区成员视图并仅标记该工作区为激活状态

#### Scenario: 激活后最近使用前置
- **WHEN** 用户激活任意工作区
- **THEN** 该工作区在后续展示顺序中位于更靠前位置（最新在前）

### Requirement: Deactivate workspace include view
当用户再次点击已激活的工作区按钮（含 `…` 列表）时，系统 MUST 取消激活并恢复到默认视图（展示所有文件/文件夹，受其他全局过滤功能影响的部分仍按其规则显示/隐藏）。

#### Scenario: 从快捷按钮取消激活
- **WHEN** 用户点击已激活的快捷工作区按钮
- **THEN** 系统恢复到默认视图并清除激活标记

#### Scenario: 从溢出列表取消激活
- **WHEN** 用户在 `…` 列表中点击当前已激活工作区
- **THEN** 系统恢复到默认视图并清除激活标记

### Requirement: Switch between workspaces
当已有激活工作区且用户点击另一个工作区按钮（快捷或溢出）时，系统 MUST 切换到新工作区的 include/whitelist 视图，并仅标记新工作区为激活。

#### Scenario: 快捷与溢出之间切换
- **WHEN** 当前激活的是快捷按钮工作区且用户在 `…` 列表中选择另一个工作区
- **THEN** 系统展示新工作区成员视图并仅标记新工作区为激活

### Requirement: Workspace membership via context menu
系统 MUST 在文件/文件夹右键菜单中提供工作区成员管理入口，允许用户将当前文件/文件夹加入或移出任意一个工作区；在多选菜单中也 MUST 支持相同操作。

右键菜单中的工作区列表 MUST 覆盖全部工作区，而非仅前 3 个。

#### Scenario: 右键菜单覆盖全部工作区
- **WHEN** 用户已配置 5 个工作区并右键文件打开菜单
- **THEN** 用户可在菜单中看到并操作全部 5 个工作区的加入/移除

### Requirement: Workspace membership management UI
系统 MUST 在设置界面提供一个二级管理界面（例如 modal），用于集中管理工作区成员。该界面 MUST 支持多选/全选与批量移除，并提供向任意工作区批量添加成员的方式。

管理界面中的工作区选择器 MUST 覆盖全部工作区，而非仅前 3 个。

#### Scenario: 管理界面切换到任意工作区
- **WHEN** 用户已配置超过 3 个工作区并打开管理界面
- **THEN** 用户可切换到任意工作区查看与批量管理成员
