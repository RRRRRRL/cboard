# CC-CANTO 数据导入指南

CC-CANTO 是一个基于 CC-CEDICT 的粤语扩展词典，使用 **CC-BY-SA 4.0** 许可证，可以安全使用。

## 下载 CC-CANTO

### 方法 1: 从官方网站下载

1. 访问: https://cantonese.org/download.html
2. 下载最新版本的 CC-CANTO 文件
3. 文件格式通常是文本文件，每行一个条目

### 方法 2: 从 GitHub 获取

CC-CANTO 数据可能也在 GitHub 上，可以搜索 "CC-CANTO" 或 "cantonese" 相关的仓库。

## 数据格式

CC-CANTO 通常使用类似 CC-CEDICT 的格式：

```
繁體字 簡體字 [粵拼] /英文解釋/
```

示例：
```
你 你 [nei5] /you/
好 好 [hou2] /good/
```

## 转换脚本

创建一个脚本来解析 CC-CANTO 格式并转换为 Cboard 所需的 CSV 格式。

