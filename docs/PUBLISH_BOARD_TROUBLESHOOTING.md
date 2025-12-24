# 发布面板问题排查指南

## 问题：发布后面板不显示在公共面板列表中

### 可能的原因

1. **面板没有卡片（tiles_count = 0）**
   - 公共面板列表只显示有卡片的 profile
   - 如果面板是空的，它不会出现在公共列表中

2. **is_public 字段没有正确更新**
   - 检查数据库中的 `is_public` 字段是否为 1

3. **缓存问题**
   - 浏览器或 API 缓存可能导致旧数据

4. **权限问题**
   - Profile 不属于当前用户

---

## 排查步骤

### 1. 检查面板是否有卡片

打开浏览器控制台，查看日志：
```
[publishBoard] Toggling isPublic: { boardId: '...', currentIsPublic: false, newIsPublic: true }
[updateApiBoard] Updating board with isPublic: { boardId: '...', isPublic: true }
[API updateBoard] Sending update request: { profileId: '...', isPublic: true }
```

### 2. 检查后端日志

查看后端日志（PHP error_log），应该看到：
```
[PROFILE SAVE BOARD] Request received: { 
  profile_id: '...',
  tiles_count_in_db: X,  // 这个数字应该 > 0
  isPublic_in_request: true,
  will_be_public: true
}
[PROFILE SAVE BOARD] Profile metadata updated successfully. Verified: {
  is_public: 1,  // 应该是 1
  tiles_count: X,  // 应该 > 0
  will_appear_in_public_list: true  // 应该是 true
}
```

### 3. 检查公共面板查询

打开 CommunicatorDialog，切换到"公共面板"标签页，查看控制台日志：
```
[CommunicatorDialog] Fetching public boards: { page: 1, search: '', limit: 10 }
[API getPublicBoards] Requesting: { url: '/board/public?...' }
[API getPublicBoards] Response received: {
  profilesCount: X,  // 应该包含你发布的面板
  total: X
}
[CommunicatorDialog] Public boards fetched: {
  total: X,
  dataCount: X,
  firstBoard: { id: '...', name: '...', isPublic: true, tilesCount: X }
}
```

### 4. 手动验证数据库

如果可能，直接查询数据库：
```sql
-- 检查 profile 的 is_public 状态
SELECT id, display_name, is_public, user_id 
FROM profiles 
WHERE id = YOUR_PROFILE_ID;

-- 检查 profile 的卡片数量
SELECT COUNT(*) as tiles_count 
FROM profile_cards 
WHERE profile_id = YOUR_PROFILE_ID AND is_visible = 1;

-- 检查是否出现在公共列表中
SELECT p.id, p.display_name, p.is_public, COUNT(pc.id) as tiles_count
FROM profiles p
LEFT JOIN profile_cards pc ON p.id = pc.profile_id AND pc.is_visible = 1
WHERE p.is_public = 1 AND p.id = YOUR_PROFILE_ID
GROUP BY p.id
HAVING tiles_count > 0;
```

---

## 常见问题解决

### 问题 1: 面板没有卡片

**症状**: `tiles_count_in_db: 0` 或 `tiles_count: 0`

**解决**: 
- 确保面板至少有一张卡片
- 添加卡片后再发布

### 问题 2: is_public 没有更新

**症状**: 后端日志显示 `is_public: 0` 或 `will_be_public: false`

**解决**:
- 检查前端是否正确发送 `isPublic: true`
- 检查后端是否正确接收和更新
- 查看后端错误日志

### 问题 3: 缓存问题

**症状**: 发布成功但列表中不显示

**解决**:
- 刷新页面（F5 或 Ctrl+R）
- 清除浏览器缓存
- 等待几秒钟后再次检查

### 问题 4: 权限问题

**症状**: 后端返回 403 错误

**解决**:
- 确保 profile 属于当前登录用户
- 检查用户认证 token 是否有效

---

## 测试步骤

1. **发布面板**:
   - 打开一个面板
   - 确保面板至少有一张卡片
   - 点击分享按钮
   - 点击"发布面板"按钮
   - 查看成功通知

2. **检查公共面板列表**:
   - 打开 CommunicatorDialog
   - 切换到"公共面板"标签页
   - 查看控制台日志
   - 检查面板是否出现在列表中

3. **如果仍然不显示**:
   - 查看浏览器控制台的所有日志
   - 查看后端错误日志
   - 检查数据库中的 `is_public` 和 `tiles_count`

---

## 调试信息收集

如果问题仍然存在，请收集以下信息：

1. **浏览器控制台日志**:
   - 所有 `[publishBoard]` 相关日志
   - 所有 `[updateApiBoard]` 相关日志
   - 所有 `[API updateBoard]` 相关日志
   - 所有 `[CommunicatorDialog]` 相关日志
   - 所有 `[API getPublicBoards]` 相关日志

2. **后端日志**:
   - 所有 `[PROFILE SAVE BOARD]` 相关日志
   - 所有 `[GET PUBLIC PROFILES]` 相关日志

3. **数据库查询结果**:
   - Profile 的 `is_public` 值
   - Profile 的 `tiles_count` 值
   - Profile 是否出现在公共列表查询中

