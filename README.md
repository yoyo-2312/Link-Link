# Link Link · 几何连连看

一款适合电脑和手机的极简几何连连看游戏。

## 玩法

选择两个相同图形。只要它们之间存在一条不穿过其他图形、最多转弯两次的路径，就能消除。连接路径可以绕过棋盘边缘。消除全部图形即可获胜；倒计时结束则本局失败。

- 轻松、标准、挑战三个难度
- 连击得分、倒计时、完成进度
- 提示消耗 10 秒；手动重排消耗 5 秒
- 无可消除组合时自动重排
- 最佳分数与音效设置保存在当前浏览器

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
