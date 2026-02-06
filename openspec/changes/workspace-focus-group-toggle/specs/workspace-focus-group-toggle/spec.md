## ADDED Requirements

### Requirement: Workspace toggle entry points
系统 MUST 在文件浏览器标题栏/顶部区域提供 3 个工作区切换按钮，按钮组与现有隐藏/显示控件风格一致并右对齐。每个按钮 MUST 显示可配置的 emoji，并在 hover 时显示可配置的提示文案。

#### Scenario: 渲染入口
- **WHEN** 用户打开文件浏览器视图
- **THEN** 系统显示 3 个右对齐的工作区按钮，外观与现有隐藏/显示按钮一致，并提供 emoji 与 hover 提示

### Requirement: Workspace configuration and persistence
系统 MUST 允许用户为每个工作区配置 emoji、hover 文案与关联的关注组/规则，并在重启后保持这些设置不丢失。

#### Scenario: 持久化配置
- **WHEN** 用户在设置中更新任意工作区的 emoji、hover 文案或关注组规则并重启应用
- **THEN** 系统仍然使用更新后的配置渲染按钮并执行对应规则

### Requirement: Activate workspace focus
当用户点击未激活的工作区按钮时，系统 MUST 记录当前关注组可见性快照，并以批量隐藏/显示方式应用该工作区的规则，使其成为当前唯一激活的工作区。

#### Scenario: 激活工作区
- **WHEN** 用户点击未激活的工作区按钮
- **THEN** 系统以批量更新方式隐藏/显示关注组并标记该工作区为激活状态

### Requirement: Deactivate workspace focus
当用户再次点击已激活的工作区按钮时，系统 MUST 恢复激活前的可见性快照并清除激活状态。

#### Scenario: 取消激活
- **WHEN** 用户点击已激活的工作区按钮
- **THEN** 系统恢复激活前的可见性并清除激活标记

### Requirement: Switch between workspaces
当已有激活工作区且用户点击另一个工作区时，系统 MUST 先恢复当前激活工作区的快照，再应用新工作区规则并更新激活状态。

#### Scenario: 切换工作区
- **WHEN** 已有工作区处于激活状态且用户点击另一个工作区按钮
- **THEN** 系统先恢复原快照，再应用新工作区规则并仅标记新工作区为激活
