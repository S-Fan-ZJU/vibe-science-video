# Vibe Video 网站

Science 与 Knowledge 的共享展示门户，托管于原 GitHub Pages 地址：

- [Science](https://s-fan-zju.github.io/vibe-science-video/)
- [Knowledge](https://s-fan-zju.github.io/vibe-science-video/knowledge.html)

`index.html` 与 `knowledge.html` 共用 `style.css`、`site.js`。2026-11-13 按作者要求重做为大字、明亮背景、实时 Canvas 主视觉和叠放作品舞台，顶部切换两个独立产品。两个 skill 的仓库与安装入口仍彼此独立；Knowledge 短片源工程维护在 [vibe-knowledge-video/examples/gallery](https://github.com/S-Fan-ZJU/vibe-knowledge-video/tree/main/examples/gallery)，这里只放网站压缩播放版。

## 本地预览

在仓库根目录启动 `python -m http.server 3211 --directory docs`，打开 `http://localhost:3211/`。这是静态网站，无需额外构建、账户或后端。

## 交互与维护

- 三部示例在一个叠放舞台切换；标签支持左右键、Home、End。非活动卡片不进入键盘焦点，切换后暂停原视频。
- 视频使用原生控制，单页任一时刻只播放一部，后台标签页自动暂停。音频只在用户播放后开始。
- 主视觉支持暂停，并响应系统减少动态效果设置；动画离屏时停止绘制。滚动入场仅做补充，禁用 JavaScript 仍可读取正文和播放所有影片。
- 底部方法图标各有对应交互：问号缓慢摇摆、电子沿椭圆运行、混色圆展开呼吸、关系边传递光点。鼠标与键盘聚焦均可触发，移开时平滑回落；整行不通过内边距变化挤动布局。
- 更换媒体后检查完整解码、手机布局、实际点击播放、切换与下载链接。修改 CSS/JS 时更新两页资源版本参数。
- 本次视觉方向仅针对网站和这三部演示，不覆盖每条新视频先确认用途、风格和声音的流程。

知识短片来源和检查见 [media/knowledge](media/knowledge/README.md)。
