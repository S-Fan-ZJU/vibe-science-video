# Knowledge 展示媒体

三部 18 秒、1280×720、60 fps、H.264＋AAC 的网页播放版。1080p60 母版和源工程由独立 [Knowledge 仓库](https://github.com/S-Fan-ZJU/vibe-knowledge-video/tree/main/examples/gallery) 管理；仓库内提供源码，完整母版保留在制作输出目录。

| 文件 | 内容 | 音轨参考 |
|---|---|---|
| birthday.mp4 / .jpg | 23 人与生日悖论，365 天均匀独立模型 | 《运气的形状》20–38 秒 |
| survivor.mp4 / .jpg | 样本筛选与幸存者偏差，人数仅作示意 | 《持续努力与突然改变》30–48 秒 |
| rosetta.mp4 / .jpg | 罗塞塔石碑，同一法令、三种文字 | 烬序《太阳神的眼睛》12–30 秒 |

三个播放器各用自己的音轨，不自动播放声音。原参考影片没有复制到网站，图形为本次原创；引用的参考音轨是成片混音摘录，未分离为纯音乐，独立许可未核实，不属于 MIT。准确来源、时间、hash 与处理见 [sources.json](sources.json)。

[validation.json](validation.json) 记录两个规格的完整解码、帧数、时间戳、音轨峰值和文件 hash。每片均检查了开场、解释中段、三个 cue 邻帧和末尾。测量检查与选帧检查不代替耳机／扬声器的主观试听，也不表示用户已经认可新的审美方向。
