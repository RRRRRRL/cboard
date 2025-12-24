# Cboard Database & Backend Architecture Summary

## 数据库结构 (Database Schema)

### 核心表 (Core Tables)

#### 1. `users` - 用户表

- **主键**: `id` (INT UNSIGNED, AUTO_INCREMENT)
- **关键字段**: `email`, `password_hash`, `name`, `role`, `auth_token`
- **用途**: 存储用户账户信息

#### 2. `profiles` - 配置文件表（核心实体）

- **主键**: `id` (INT UNSIGNED, AUTO_INCREMENT)
- **外键**: `user_id` → `users.id` (ON DELETE CASCADE)
- **关键字段**:
  - `display_name`: 显示名称
  - `name`: 别名（向后兼容）
  - `description`: 描述
  - `layout_type`: 布局类型 (e.g., '1x1', '4x6', 'grid')
  - `language`: 语言代码 (e.g., 'zh-HK', 'en')
  - `root_board_id`: 指向 `boards.board_id` 的字符串 ID（用于 Cboard 兼容性）
  - `is_default`: 是否为默认 profile
  - `is_public`: 是否公开
- **用途**: **Profile = Board** - 这是用户通信板的核心实体，代表一个用户的通信配置

#### 3. `boards` - 板数据表（兼容性表）

- **主键**: `id` (INT UNSIGNED, AUTO_INCREMENT)
- **唯一键**: `board_id` (VARCHAR(255)) - Cboard 的 board 标识符
- **外键**:
  - `user_id` → `users.id` (ON DELETE CASCADE)
  - `profile_id` → `profiles.id` (ON DELETE SET NULL)
- **关键字段**:
  - `board_data`: JSON 格式的完整板数据（tiles, grid, 等）
  - `is_public`: 是否公开
  - `is_fixed`: 是否固定
- **用途**: 存储 Cboard 格式的 `board_data` JSON，通过 `profiles.root_board_id` 关联
- **状态**: 这是**兼容性表**，主要用于存储 `board_data`，未来可能被移除

#### 4. `cards` - 卡片表

- **主键**: `id` (INT UNSIGNED, AUTO_INCREMENT)
- **关键字段**:
  - `title`: 标题
  - `label_text`: 标签文本
  - `image_path`, `image_url`: 图片路径
  - `audio_path`, `sound_url`: 音频路径
  - `category`: 分类
  - `card_data`: JSON 格式的额外数据
- **用途**: 存储独立的符号卡片

#### 5. `profile_cards` - Profile-Card 关联表

- **主键**: `id` (INT UNSIGNED, AUTO_INCREMENT)
- **外键**:
  - `profile_id` → `profiles.id` (ON DELETE CASCADE)
  - `card_id` → `cards.id` (ON DELETE CASCADE)
- **关键字段**:
  - `row_index`, `col_index`, `page_index`: 布局位置
  - `is_visible`: 是否可见
  - `position`: 排序位置
- **唯一约束**: `(profile_id, card_id, page_index, row_index, col_index)`
- **用途**: 多对多关系，将卡片链接到 profile 并存储布局位置

### 关系图 (Relationships)

```
users (1) ──< (N) profiles
                │
                ├──> (1) boards (通过 root_board_id)
                │
                └──> (N) profile_cards ──< (N) cards
```

**关键概念**:

- **Profile = Board**: 一个 `profile` 就是一个通信板
- **Profile 包含 Cards**: 通过 `profile_cards` 表关联
- **Profile 有 Root Board**: 通过 `root_board_id` 指向 `boards` 表中的 `board_data` JSON

## 后端 API 路由 (Backend API Routes)

### Profile 路由 (`backend/api/routes/profile.php`)

#### 列表端点 (List Endpoints)

1. **GET `/board`** 或 **GET `/board/public`**

   - **功能**: 获取公开的 profiles
   - **实现**: `getPublicProfilesHelper()`
   - **查询**: `SELECT * FROM profiles WHERE is_public = 1 AND user_id <> 1`
   - **用途**: 公共板库

2. **GET `/board/my`**

   - **功能**: 获取当前用户的所有 profiles
   - **认证**: 需要
   - **查询**: `SELECT * FROM profiles WHERE user_id = ?`
   - **用途**: "All My Boards" 标签页

3. **GET `/profiles`**

   - **功能**: 获取当前用户的 profiles（带搜索）
   - **认证**: 需要
   - **查询**: `SELECT * FROM profiles WHERE user_id = ? [AND search conditions]`

4. **GET `/profiles/public`**
   - **功能**: 获取公开 profiles（可过滤语言和布局类型）
   - **认证**: 不需要
   - **实现**: `getPublicProfilesHelper()`

#### 单个 Profile 端点 (Single Profile Endpoints)

5. **GET `/profiles/{id}`**

   - **功能**: 获取单个 profile
   - **认证**: 需要（除非是公开的）
   - **权限**: 必须是所有者或公开的

6. **POST `/profiles`**

   - **功能**: 创建新 profile
   - **认证**: 需要
   - **逻辑**: 如果是第一个 profile，自动设为 `is_default = 1`

7. **PUT `/profiles/{id}`**

   - **功能**: 更新 profile
   - **认证**: 需要
   - **权限**: 必须是所有者

8. **DELETE `/profiles/{id}`**
   - **功能**: 删除 profile
   - **认证**: 需要
   - **权限**: 必须是所有者
   - **级联删除**:
     - `profile_cards` (ON DELETE CASCADE)
     - `boards` (手动删除 `root_board_id` 对应的 board)

#### Profile Board 端点 (Profile Board Endpoints)

9. **GET `/profiles/{id}/board`**

   - **功能**: 获取 profile 的 root board 数据
   - **流程**:
     1. 从 `profiles` 表获取 `root_board_id`
     2. 从 `boards` 表获取 `board_data` JSON
     3. 合并返回给前端

10. **PUT `/profiles/{id}/board`**
    - **功能**: 更新 profile 的 root board 数据
    - **流程**:
      1. 如果 `root_board_id` 不存在，创建一个新的
      2. 将前端传来的 board 数据存储为 JSON 到 `boards.board_data`
      3. 同步 `profiles.is_public` 和 `boards.is_public`

#### 其他端点

11. **POST `/profiles/import-public/{id}`**

    - **功能**: 导入公开 profile 到当前用户账户
    - **流程**: 复制 profile 和相关的 boards

12. **POST `/profiles/report`**

    - **功能**: 报告 profile（目前只记录日志）

13. **GET `/profiles/templates`**
    - **功能**: 获取可用的布局模板
    - **认证**: 不需要

### 路由重定向逻辑 (`backend/api/index.php`)

```php
// Legacy /board 列表端点现在重定向到 profile 路由
if ($route === 'board') {
    // List endpoints → profile routes
    if (count($pathParts) === 1 ||
        (count($pathParts) === 2 && ($pathParts[1] === 'public' || $pathParts[1] === 'my'))) {
        return handleProfileRoutes($method, $pathParts, $data, $authToken);
    }
    // Single board CRUD → board routes (deprecated)
    return handleBoardRoutes($method, $pathParts, $data, $authToken);
}
```

## 数据流 (Data Flow)

### 前端 → 后端

1. **创建 Board/Profile**:

   ```
   Frontend: POST /profiles → Backend: 创建 profile
   Frontend: PUT /profiles/{id}/board → Backend: 创建/更新 boards 记录
   ```

2. **获取 Board/Profile**:

   ```
   Frontend: GET /board/my → Backend: 查询 profiles WHERE user_id = ?
   Frontend: GET /profiles/{id}/board → Backend: 查询 boards WHERE board_id = root_board_id
   ```

3. **删除 Board/Profile**:
   ```
   Frontend: DELETE /profiles/{id} → Backend:
     - 删除 profile (级联删除 profile_cards)
     - 删除 boards WHERE board_id = root_board_id
   ```

### 后端 → 前端

1. **Profile 列表**: 返回 `{ profiles: [...], total, page, limit }`
2. **Board 数据**: 返回合并的 board 对象（包含 `board_data` JSON 中的所有字段）

## 关键设计决策

### ✅ 已实现

1. **Profile-centric 架构**: 所有逻辑围绕 `profiles` 表
2. **向后兼容**: 保留 `boards` 表存储 `board_data` JSON
3. **统一 API**: `/board` 列表端点现在返回 profiles
4. **级联删除**: `profile_cards` 自动删除，`boards` 手动删除

### ⚠️ 注意事项

1. **`boards` 表状态**:

   - 目前仍在使用（存储 `board_data`）
   - 未来可能完全移除，将 `board_data` 直接存储在 `profiles` 表中

2. **`root_board_id` 类型**:

   - 在 `profiles` 表中是 `VARCHAR(255)`
   - 在 `boards` 表中是 `board_id` (VARCHAR(255))
   - 这是字符串 ID，不是整数

3. **`profile_cards` vs `board_data`**:
   - `profile_cards`: 新的结构化方式（卡片 + 位置）
   - `board_data`: 旧的 Cboard JSON 格式（tiles 数组）
   - 目前两者可能并存

## 待优化项

1. **统一数据模型**: 完全迁移到 `profile_cards` + `cards`，移除 `board_data` JSON
2. **移除 `boards` 表**: 将 `board_data` 直接存储在 `profiles` 表中
3. **API 清理**: 移除所有 `/board` 单板 CRUD 端点（已废弃）
