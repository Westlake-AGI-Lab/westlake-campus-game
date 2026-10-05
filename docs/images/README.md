# README 游戏截图

这里存放主 README 使用的游戏内截图，不是校园参考照片或图纸。图片来自本项目 2026 年 10 月 5 日的浏览器验证截图，校园截图分辨率为 1280 × 720；角色定制图来自独立浏览器注册测试，以 PNG 原样复制。

## 对应来源

来源文件位于项目根目录的 `reports/screenshots/`。这些截图由浏览器中的实际 Three.js 场景生成；建筑近景使用校园预设相机，并隐藏操作面板。全校总览保留游戏界面。

| 本目录文件 | 原始截图 | 内容 |
| --- | --- | --- |
| vehicle-parking.png | vehicle-parking.png | v1.5.0 共享停车区 |
| vehicle-driving.png | vehicle-driving.png | v1.5.0 驾驶面板与车辆 |
| campus-numbered-overview.png | campus-overview.png | v1.4.1 全校楼号标注 |
| art-aerial.png | art-aerial.png | v1.4.0 校园鸟瞰 |
| art-loop.png | art-loop.png | v1.4.0 学术环与植被 |
| art-water.png | art-water.png | v1.4.0 水岸 |
| avatar-customization.png | avatar-customization.png | v1.3.0 注册三维角色定制 |
| campus-aerial.png | view-aerial.png | 学术核心鸟瞰 |
| campus-overview.png | campus-overview.png | 全校总览、楼号与玩家位置 |
| academic-loop.png | view-loop.png | 学术环 E10 |
| academic-hall.png | view-hall.png | 学术会堂 E0 |
| library.png | view-library.png | 图书中心 E12 |
| administration.png | view-detail-A1.png | 行政楼 A1 |
| student-center.png | view-detail-H5.png | 学生活动中心 / 食堂 H5 |
| sports-center.png | view-detail-sports.png | 综合体育馆 J1 与田径场 |
| south-gate.png | view-gate.png | 南校门 |
| waterfront-bridge.png | view-water.png | 水环与桥梁 |

## 更新方式

场景、楼号或界面发生明显变化时，重新构建并运行隔离的浏览器验证，人工检查生成截图后，将选定图片复制到本目录。完整流程见主 README 的测试章节；不要为截图操作正式玩家数据库。

`tests/e2e/visual.spec.ts` 会采集全部固定视角和全校总览。`scripts/capture-regions.mjs` 也能采集固定视角，但默认访问本机 `:3000` 并注册账号，使用前须确认它连接的是专用测试服务。

保留本目录的稳定文件名，并同步修改主 README 的说明、楼号和采集日期。不要直接引用会被后续测试覆盖的报告路径，也不要混入参考原图、对照报告截图、账号密码或令牌。当前这些游戏截图随本项目原创生成资产使用 MIT 许可，见项目根目录的 `LICENSE`。

- `ambience-rain.png`、`ambience-lab.png`、`ambience-cat.png`：v1.6.0 隔离测试房间实拍，分别为白昼雨天预览、深夜亮窗和校园猫互动。不是现实天气或动物位置记录。

- `shuttle-exterior.png`、`shuttle-riding.png`、`shuttle-overview.png`：v1.7.0 隔离测试房间实际截图，包含自动校车外观、真实乘客、跟车视角与小地图环线。线路和站点是游戏设计。

- `leaderboard.png` / `leaderboard-mobile.png`：v1.11.0 历史累计榜单，真实临时测试房间截图，未伪造正式玩家记录。
