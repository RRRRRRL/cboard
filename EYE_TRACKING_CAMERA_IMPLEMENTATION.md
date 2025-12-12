# 摄像头眼球追踪实现说明

## 选择的 API: WebGazer.js

### 为什么选择 WebGazer.js？

对于 AAC（辅助和替代沟通）项目，我们选择了 **WebGazer.js** 作为摄像头眼球追踪解决方案，原因如下：

1. **专为网页设计** - 完全基于浏览器，无需额外硬件
2. **完全免费和开源** - MIT 许可证，无使用成本
3. **易于集成** - 简单的 JavaScript API，易于使用
4. **适合 AAC 场景** - 专为辅助沟通应用设计
5. **实时性能** - 低延迟，适合实时交互
6. **隐私保护** - 所有处理在本地浏览器完成，数据不上传

### WebGazer.js 简介

WebGazer.js 是由布朗大学开发的开源眼球追踪库，使用机器学习算法通过普通网络摄像头进行眼球追踪。它使用 JavaScript 和 WebRTC 在浏览器中实时处理视频流。

**官方网站**: https://webgazer.cs.brown.edu/
**GitHub**: https://github.com/brownhci/WebGazer

## 实现细节

### 1. 库加载

WebGazer.js 通过 CDN 加载在 `public/index.html` 中：

```html
<script src="https://webgazer.cs.brown.edu/webgazer.js" defer></script>
```

### 2. 设备类型

在 `src/components/Settings/EyeTracking/EyeTracking.constants.js` 中添加了新的设备类型：

```javascript
export const EYE_TRACKING_DEVICE_TYPES = {
  TOBII: 'tobii',
  EYETRIBE: 'eyetribe',
  PUPIL: 'pupil',
  CAMERA: 'camera', // WebGazer.js - browser camera-based eye tracking
  CUSTOM: 'custom'
};
```

### 3. 初始化逻辑

在 `src/utils/eyeTrackingIntegration.js` 中实现了 `initializeCamera()` 方法：

```javascript
async initializeCamera() {
  // 1. 检查 WebGazer 是否可用
  // 2. 请求摄像头权限
  // 3. 注册设备到后端
  // 4. 初始化 WebGazer 并设置凝视监听器
}
```

### 4. 凝视追踪

WebGazer 通过 `setGazeListener` 回调函数提供凝视位置：

```javascript
window.webgazer.setGazeListener((data, elapsedTime) => {
  if (data == null) return;
  const x = data.x;
  const y = data.y;
  this.handleGaze(x, y);
});
```

### 5. 清理

当禁用眼球追踪时，调用 `webgazer.pause()` 或 `webgazer.end()` 停止追踪并释放摄像头资源。

## 使用说明

### 用户设置步骤

1. **启用眼球追踪**
   - 进入设置 → 眼球追踪
   - 打开"启用眼球追踪"开关

2. **选择设备类型**
   - 在设备类型下拉菜单中选择"Web Camera (WebGazer)"

3. **注册设备**
   - 点击"注册设备"按钮
   - 浏览器会请求摄像头权限，用户需要允许

4. **校准（可选）**
   - 点击"开始校准"按钮
   - 按照屏幕上的校准点进行校准
   - 校准可以提高追踪准确性

5. **设置停留时间**
   - 调整滑块设置注视卡片多长时间后自动选择
   - 默认 1000 毫秒（1 秒）

### 技术要求

- **浏览器**: Chrome、Firefox、Edge（最新版本）
- **摄像头**: 任何 USB 摄像头或内置摄像头
- **网络**: 首次加载需要网络连接（下载 WebGazer.js）
- **HTTPS**: 生产环境需要 HTTPS（摄像头 API 要求）

## 优势

### 相比专业设备（Tobii、EyeTribe）

✅ **成本**: 完全免费，无需购买昂贵硬件
✅ **便携性**: 任何有摄像头的设备都可以使用
✅ **易用性**: 无需安装驱动或额外软件
✅ **可访问性**: 降低 AAC 工具的使用门槛

### 技术优势

✅ **实时处理**: 低延迟，适合实时交互
✅ **隐私保护**: 所有处理在本地完成
✅ **跨平台**: 支持 Windows、Mac、Linux、移动设备
✅ **易于维护**: 基于 Web 标准，无需原生代码

## 限制和注意事项

### 准确性

- WebGazer 的准确性低于专业眼球追踪设备（如 Tobii）
- 受光照条件影响
- 需要用户保持相对稳定的头部位置
- 建议进行校准以提高准确性

### 性能

- 需要一定的 CPU 资源进行实时视频处理
- 在低性能设备上可能影响流畅度
- 建议在较新的设备上使用

### 浏览器兼容性

- 需要支持 WebRTC 和 MediaDevices API
- 某些旧版浏览器可能不支持
- 移动浏览器支持有限

### 隐私和安全

- 需要用户明确授权摄像头访问
- 所有处理在本地完成，数据不上传
- 建议在隐私政策中说明摄像头使用

## 未来改进

1. **离线支持**: 将 WebGazer.js 下载到本地，支持离线使用
2. **性能优化**: 优化视频处理算法，降低 CPU 使用
3. **移动优化**: 改进移动设备上的追踪准确性
4. **多用户支持**: 支持多个用户配置文件，保存个人校准数据
5. **高级校准**: 添加更多校准点和校准选项

## 相关文件

- `src/utils/eyeTrackingIntegration.js` - 眼球追踪集成逻辑
- `src/components/Settings/EyeTracking/` - 眼球追踪设置 UI
- `public/index.html` - WebGazer.js 库加载
- `src/components/Settings/EyeTracking/EyeTracking.constants.js` - 设备类型常量

## 参考资料

- WebGazer.js 官方文档: https://webgazer.cs.brown.edu/
- WebGazer.js GitHub: https://github.com/brownhci/WebGazer
- WebRTC API: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API
- MediaDevices API: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices

