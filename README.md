# Link Link · 几何连连看

一款适合电脑和手机的极简几何连连看游戏。打开网页即可进入当前关卡，无需滚动页面。

## 玩法

选择两个相同图形。只要它们之间存在一条不穿过其他图形、最多转弯两次的路径，就能消除。连接路径可以绕过棋盘边缘。消除全部图形即可获胜；倒计时结束则本局失败。

- 30 关、5 个章节，通关后按顺序解锁下一关
- 已通关关卡可随时重玩；星级与最佳分数保存在当前浏览器
- 关卡逐步增加棋盘规模、图形种类与固定障碍，第 19 关起加入重力下落
- 连击得分、倒计时、完成进度
- 每关有 2 次提示和 1 次手动重排
- 无可消除组合时自动重排
- 音效设置保存在当前浏览器

## 本地开发

需要 Node.js 20.19+ 或 22.12+。

```bash
npm install
npm run dev
```

运行测试和生产构建：

```bash
npm test
npm run build
```

项目使用 React、TypeScript 和 Vite。棋盘规则位于 `src/game.ts`，界面位于 `src/App.tsx`，样式位于 `src/styles.css`。

## 发布

推送到 `main` 后，GitHub Actions 会构建并发布到 GitHub Pages。首次发布时，仓库的 **Settings → Pages → Build and deployment** 应选择 **GitHub Actions**。
