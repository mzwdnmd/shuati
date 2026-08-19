---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 3323ae55102db97ad941b7fe8dc7cacf_993bb0a89b6d11f18cca525400e6dd8f
    ReservedCode1: OPOLHjvR24IWqDE68NVPEjuen2MPrhmhAHIei54Siu/mK1aQu7AHEhIjnkuPxWvTHWmUvFViNX+Na4acaWbZAAy2wpoBCs6fckQuv5/gGKnSt4WiV5+n2rfr8iQO6s41ar4rT7oLG+mq3Bb/jO8ywZvot5ciYp/MhOsJjizXbffi8o/wCAFbdapd/ko=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 3323ae55102db97ad941b7fe8dc7cacf_993bb0a89b6d11f18cca525400e6dd8f
    ReservedCode2: OPOLHjvR24IWqDE68NVPEjuen2MPrhmhAHIei54Siu/mK1aQu7AHEhIjnkuPxWvTHWmUvFViNX+Na4acaWbZAAy2wpoBCs6fckQuv5/gGKnSt4WiV5+n2rfr8iQO6s41ar4rT7oLG+mq3Bb/jO8ywZvot5ciYp/MhOsJjizXbffi8o/wCAFbdapd/ko=
---

# 日课

一个好看优雅、可自定义题库的刷题工具。术数（手相、堪舆等）内容的第一块基石。

## 快速开始

```bash
npm install
npm run dev      # 本地开发
npm run build    # 构建到 dist/
```

## 题库即文件

题库在 `src/data/` 下，每个题库一个 `.js` 文件，导出格式：

```js
export default {
  id: 'shouxiang',          // 题库唯一 ID
  name: '手相入门',          // 题库名称
  description: '一句话说明',  // 题库描述
  questions: [
    {
      id: 'sx001',
      type: 'single',         // 题型，目前支持 single（单选）
      question: '题目文本',
      options: ['选项一', '选项二', '选项三', '选项四'],
      answer: 0,              // 正确答案索引（从 0 开始）
      explanation: '解析文本'
    }
  ]
}
```

新增题库：在 `src/data/` 新建文件 → 在 `src/data/index.js` 中注册 → 刷新即出现在首页。

## 部署到 GitHub Pages

1. 用 GitHub Desktop 添加本地仓库并 `Publish repository`（建议仓库名 `shuati`）
2. 打开仓库 Settings → Pages → Source 选择 `GitHub Actions`
3. 推送 `main` 分支后自动构建部署，访问 `https://<你的用户名>.github.io/shuati/`

## 路线图

- [x] 项目骨架 + GitHub Pages 自动部署
- [x] 手相入门题库（10 题打样）
- [ ] 刷题体验打磨（动效 / 节奏 / 反馈）
- [ ] 自定义题库导入（JSON 文件导入）
- [ ] 错题本 / 进度统计
- [ ] PWA 离线支持
- [ ] 堪舆题库
*（内容由AI生成，仅供参考）*
