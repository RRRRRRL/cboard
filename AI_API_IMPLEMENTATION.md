# AI API 实现说明

## 当前实现状态

### 当前使用的 AI 方法

**目前 AI 功能使用的是基于数据库的简单匹配算法，而不是真正的 AI API。**

#### 1. 卡片建议 (Card Suggestions)

- **方法**: 基于关键词的数据库查询
- **实现**: 使用 SQL LIKE 查询匹配卡片标题和标签
- **位置**: `backend/api/routes/ai.php` 第 48-84 行
- **当前逻辑**:
  - 从用户输入上下文中提取关键词
  - 在数据库中搜索匹配的卡片
  - 如果没有匹配，返回用户常用卡片
  - 如果仍没有，返回系统热门卡片

#### 2. 输入预测 (Typing Prediction)

- **方法**: 基于数据库的词汇匹配
- **实现**:
  - 中文/粤语：使用 `jyutping_dictionary` 表进行匹配
  - 英文：使用 `cards` 表中的标签进行匹配
- **位置**: `backend/api/routes/ai.php` 第 97-165 行
- **当前逻辑**:
  - 根据输入的前缀在字典/卡片表中查找匹配项
  - 按使用频率排序返回结果

#### 3. 粤拼预测 (Jyutping Prediction)

- **方法**: 基于 `jyutping_dictionary` 数据库表
- **实现**: SQL LIKE 查询匹配粤拼前缀
- **位置**: `backend/api/routes/ai.php` 第 167-224 行
- **当前逻辑**:
  - 根据输入的粤拼前缀查找匹配的中文字符
  - 按频率排序返回结果

#### 4. 自适应学习 (Adaptive Learning)

- **方法**: 基于数据库统计
- **实现**: 使用 `jyutping_learning_log` 表记录学习数据
- **位置**: `backend/api/routes/ai.php` 第 226-294 行
- **当前逻辑**:
  - 记录用户的学习尝试和正确率
  - 根据表现调整难度级别

## 如何集成真正的 AI API

### 推荐选项

#### 选项 1: OpenAI GPT API

```php
// 需要安装: composer require openai-php/client
use OpenAI\Client;

function getAISuggestions($context, $profileId) {
    $client = new Client(getenv('OPENAI_API_KEY'));

    $response = $client->chat()->create([
        'model' => 'gpt-3.5-turbo',
        'messages' => [
            ['role' => 'system', 'content' => 'You are an AAC card suggestion assistant.'],
            ['role' => 'user', 'content' => "Suggest cards for context: $context"]
        ]
    ]);

    return $response->choices[0]->message->content;
}
```

#### 选项 2: Google Cloud AI (Vertex AI)

```php
// 需要安装: composer require google/cloud-aiplatform
use Google\Cloud\AIPlatform\V1\PredictionServiceClient;

function getAISuggestions($context, $profileId) {
    $client = new PredictionServiceClient();
    // 实现 Vertex AI 调用
}
```

#### 选项 3: Azure Cognitive Services

```php
// 使用 Azure Language Understanding (LUIS) 或 Text Analytics
function getAISuggestions($context, $profileId) {
    $endpoint = getenv('AZURE_AI_ENDPOINT');
    $key = getenv('AZURE_AI_KEY');
    // 实现 Azure AI 调用
}
```

### 环境变量配置

在 `.env` 文件中添加：

```env
# OpenAI
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_MODEL=gpt-3.5-turbo

# 或 Google Cloud
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json

# 或 Azure
AZURE_AI_ENDPOINT=https://your-resource.cognitiveservices.azure.com
AZURE_AI_KEY=your-azure-key
```

### 集成步骤

1. **选择 AI 服务提供商**
2. **安装相应的 PHP SDK**
3. **在 `backend/api/routes/ai.php` 中替换简单查询逻辑**
4. **添加错误处理和回退机制**（如果 AI API 失败，使用当前数据库方法）
5. **配置环境变量**
6. **测试和优化**

### 注意事项

- **成本**: AI API 调用会产生费用，需要实施缓存和速率限制
- **延迟**: AI API 调用比数据库查询慢，考虑异步处理
- **隐私**: 确保用户数据符合隐私政策
- **回退**: 始终保留数据库查询作为回退方案

## 当前实现优势

- ✅ 无需 API 密钥或外部服务
- ✅ 响应速度快（数据库查询）
- ✅ 无额外成本
- ✅ 数据隐私（所有数据本地存储）

## 当前实现限制

- ❌ 智能程度有限（基于关键词匹配）
- ❌ 无法理解上下文语义
- ❌ 无法生成新内容
- ❌ 预测准确性较低
