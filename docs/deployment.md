# 服务器部署

目标服务器：`USER@HOST`（自行替换，不内置原维护环境地址），游戏端口 `3000`。部署使用本地已通过检查的 `dist` 与 `dist-server`，生产依赖按锁文件安装。无需在服务器安装开发工具或 GPU 渲染库。

部署目录：`/home/USER/apps/westlake-campus/releases/<版本>`；`current` 软链接指向当前版本。启动配置见 `deployment/westlake-campus.service`，使用服务器现有 Node.js 24.10.0，不改动系统 Node.js。部署时需要启用用户服务 Linger，支持退出 SSH 后继续运行和系统启动时运行。

管理员操作：

```bash
ssh USER@HOST
systemctl --user status westlake-campus
journalctl --user -u westlake-campus -n 100 --no-pager
systemctl --user restart westlake-campus
systemctl --user stop westlake-campus
systemctl --user start westlake-campus
curl http://127.0.0.1:3000/health
```

访问地址：`http://HOST:3000/`，需要客户端能连接你自己的部署地址。同一服务器和端口的所有页面连接同一多人房间。服务重启后房间重新创建，在线页面自动恢复同一账号的位置与战绩。账号数据库位于独立的 shared 目录，更新 release 不会覆盖它。

更新时先建立新版本目录、安装生产依赖并检查构建文件，再切换 `current` 和重启本服务。回退时将 `current` 改指向保留的上一版本并重启。检查记录保存在本地 `reports/deployment-results.json`；该文件只有实际部署及远程验证完成后才写入成功状态。

## 双向源码同步

每次发布前运行：

```bash
python3 scripts/sync-source.py --merge --host USER@HOST --remote-root /home/USER/apps/westlake-campus/current
npm run build
npm test
npm run test:e2e
```

脚本从服务器 current 读取源码，以 `.sync-base/source.tar.gz` 上次一致的发布为基线，合并单方改动和双方不同位置的文本改动。双方冲突时不写入任何部分结果，先解决冲突再发布。合并完成后将本地完整源码和构建上传到新 release，保留旧版本，核对 SHA-256，再切换 current 并重启本游戏。发布后运行 `python3 scripts/sync-source.py --record --host USER@HOST --remote-root /home/USER/apps/westlake-campus/current`；只有本地与服务器全部源码相等才更新基线。审计见 `reports/source-sync-audit.json`。

源码同步包含客户端、服务器、场景和用户名策略数据、脚本、测试、文档及服务配置。生成构建、报告、依赖和运行数据库不做三方合并。`var/`、shared 数据库、`.env` 和会话令牌不上传，也不从服务器拉入交付包。服务器的玩家存档持续作为正式存档；本地测试存档独立保留。

## 存档备份

正式服务设置 `ACCOUNT_DB=/home/USER/apps/westlake-campus/shared/accounts.sqlite`。shared 目录仅账号用户可访问。正常更新不移动数据库。备份运行中的 SQLite 请用 Node SQLite `VACUUM INTO` 或 SQLite 在线备份接口；不能只复制主文件而漏掉 WAL。回退代码也继续使用同一个数据库。首次账号版本之前没有长期存档，旧匿名身份不能转成新账号。

## 黑盒验证

`scripts/verify-deployment.mjs` 核对实际资源 SHA-256，并在同版本独立 3001 测试服务验证注册 / 重名拒绝 / 错误密码、双页面移动、拳击、战绩、退出登录、地图空降、步行导航和总览。显式设置 `DEPLOY_VERIFY_RESTART=1` 才会终止 `DEPLOY_VERIFY_SERVICE` 指定的测试游戏进程，核对 systemd 自动恢复、同一账号、位置与战绩。测试数据库独立；结束后关闭测试房间。

正式 3000 房间只做资源、注册入口和健康检查；完整游戏测试在独立房间执行。部署时重启正式服务完成升级。已有页面请刷新。已注册账号继续使用原登录用户名与密码；三字旧用户名保留为私有登录名，公开显示名字自动换成另一组有效候选字，位置和记录保持。房间上限为 128 人。

## 私有用户名版本的存档升级

新版本把登录用户名与公开显示名字分开，数据库版本升级到 2。旧 `accounts.name` 继续保存私有用户名，新增 `display_name`。不要重建账号表或删除旧存档。

先在新 release 完成构建、资源哈希及独立房间验证，再停止正式游戏服务，让最后的位置与记录保存。使用服务器本机 Node SQLite `VACUUM INTO` 将存档一致备份到 shared/backups 下的新文件，目录权限 700、文件权限 600；备份不上传或下载。随后用新 release 执行：

```bash
/home/USER/.nvm/versions/node/v24.10.0/bin/node dist-server/migrate-accounts.js /home/USER/apps/westlake-campus/shared/accounts.sqlite
```

迁移工具要求指定已经存在的数据库，事务内添加公开名字，并核对原账号 ID、用户名、密码摘要、会话令牌、位置、记录和更新时间全部保持。输出只有验证结果与账号数量。通过后切换 current 并启动正式服务，检查健康、资源及源码同步。迁移失败时保持停服并排查，不能把失败当作成功发布。

后续代码回退应使用支持当前数据库版本及分离用户名协议的版本。升级之前的代码不能正确处理新注册的自由用户名。恢复升级前备份会丢失备份之后的存档，不可在已有新写入时自动恢复旧备份。详见 [账号迁移规则](accounts.md)。

## v1.3.0 角色外观升级

数据库升级到版本 3，增加 `appearance_json`，不删除或重建账号表。先在独立测试房间验证新 release 的角色定制、预览、多人同步和重新登录，再正常停止正式服务。使用服务器本机 SQLite `VACUUM INTO` 创建 shared/backups 下的新备份，目录权限 700、文件权限 600；备份不下载或纳入交付包。

使用新 release 的 `dist-server/migrate-accounts.js` 离线迁移正式数据库。工具动态核对所有原有列和账号数量，确保认证、位置、记录与已有显示名字保持；通过后切换 current、启动正式服务，核对版本、资源哈希与双向源码同步。旧账号外观在下一次成功认证进入时初始化，旧会话仍可恢复。

版本 2 程序拒绝版本 3 数据库；代码回退需要兼容版本 3 的程序。已经产生新存档后不能用升级前备份覆盖数据库。详细规则见 [账号说明](accounts.md) 和 [外观说明](appearance.md)。

## v1.5.0 共享车辆

本版本不改变账号数据库结构。车辆位置和占用状态存在当前服务器房间，服务重启后四辆车回到停车区，不写入或迁移 SQLite。发布前在独立房间执行车辆浏览器验收，确认上车、驾驶、转向、刹车、下车、换人驾驶及断线释放，随后执行完整发布验收。

正常停止服务会保存玩家位置并释放驾驶席；服务恢复后账号站在安全位置，不自动恢复驾驶。若存档落在重置的车身内部，重新登录会选择车旁安全落点。正式存档仍使用 shared/accounts.sqlite，发布包不包含数据库。车辆规则见 [车辆说明](vehicles.md)。

### v1.6.0 环境彩蛋

昼夜天气按服务器时间计算，客户端本地预览不保存。猫与亮窗不写入账号存档，没有数据库迁移；仍使用服务器原 accounts.sqlite。发布须验证天气、彩蛋、猫及原有导航车辆流程。

### v1.7.0 校车

无需数据库迁移。发布和重启后校车从南门、北门站重新运行；下线乘客释放座位并存储安全步行落点。验收须使用隔离数据库测试真实双页面同乘和随时下车，不在正式存档里创建测试账号。

## 公开部署模板

`deployment/westlake-campus.service` 使用 `%h` 展开服务用户的主目录，`ExecStart=/usr/bin/node` 是示例：先用 `command -v node` 确认 Node.js >=22.13.0 的绝对路径，再修改服务副本。现有维护环境使用 Node.js 24.10.0；安装模板不要求修改系统 Node.js。复制到 `~/.config/systemd/user/` 后执行 `systemctl --user daemon-reload`，按需 `systemctl --user enable --now westlake-campus.service` 和 `loginctl enable-linger`。公开仓库不提供任何远程密码、玩家数据库或正式发布清单。

验证时设置 `DEPLOY_URL=http://HOST:3001 DEPLOY_SSH_HOST=USER@HOST DEPLOY_VERIFY_SERVICE=YOUR-TEST-SERVICE.service`；正式服务只使用 `DEPLOY_SMOKE_ONLY=1` 的只读检查。发布清单需由自己的部署流程生成，不能把维护者历史报告当作自己的验收。
