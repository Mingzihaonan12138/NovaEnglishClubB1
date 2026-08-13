# 上线清单

写给早上的你。三件事，第一件是其他两件的前提。

---

## ⚠️ 先解决：Firebase 项目不在你的账号下

B1 用的 Firebase 项目是 `gen-lang-client-0538041967`。这是 AI Studio 自动创建的项目，
**不在 xuanyu.diao@gmail.com 名下**（用你的号登录 Firebase CLI，列出来只有 `fin-diao`
和 `novavocab-c9c2e`，点名访问这个项目返回 `403 The caller does not have permission`）。

后果不只是"今天发布不了规则"：

- 发布安全规则要这个项目的权限
- 把网站域名加进 Auth 授权域名要这个项目的权限（不加 Google 登录直接失败）
- 哪天这个账号收不回来，学生数据就在别人那里

**先查清楚它到底在谁名下：**
打开 https://console.firebase.google.com ，用你可能用过的每个 Google 账号各登一次，
看哪个账号的项目列表里有 `gen-lang-client-0538041967`。最可能的是你当初在
AI Studio 里登录的那个账号。

**然后两条路，选一条：**

**A. 拿回所有权** —— 用能进那个项目的账号登录 Firebase 控制台，
在「用户和权限」里把 xuanyu.diao@gmail.com 加成「拥有者」。最省事，数据不动。

**B. 换成你自己的项目**（B2 那次就是这么干的，`novavocab-c9c2e` 就是这么来的）——
在自己账号下新建一个 Firebase 项目，开 Google 登录、建 `(default)` Firestore，
把新的 config 填进 `firebase-applet-config.json`。代价是现有数据不迁移，从头开始。
考虑到现在录音本来就一条都没存成，损失几乎为零，B 其实很划算。

---

## 1. 发布 Firestore 规则

Firebase 控制台 → 项目 → **Firestore Database** → 确认顶部数据库是 **`(default)`**
→ 「规则」标签 → 全选覆盖成本仓库 `firestore.rules` 的内容 → **点「发布」**。

粘贴不算数，必须点发布。

---

## 2. 部署到 Vercel

已经准备好 `vercel.json`（静态构建 + SPA 路由）。在仓库目录跑：

```bash
npx vercel --prod
```

CLI 已经登录为 `mingzihaonan12138`。

**部署完必须做**：把拿到的 `xxx.vercel.app` 域名加进
Firebase 控制台 → Authentication → Settings → **授权域名**。
不加的话 Google 登录会报 `auth/unauthorized-domain`，谁都进不来。

---

## 3. 考官音频（不急）

`server.ts` 里那套按需生成音频的功能**在 Vercel 上不能用**——无服务器函数没有可写的
磁盘，重启就没了。生产环境目前的表现是：找不到音频文件就回退到浏览器自带 TTS，能用，
但不是 Sonia 那种质量。

正式方案照搬 B2：本地跑 `npx tsx scripts/generate_part1_audio.ts` 全量生成，
推到 CDN 仓库（`b2-audio` + jsDelivr），把题库里的路径换成 CDN 绝对地址。
这件事和上线互不阻塞。

---

## 上线后第一件要验证的

用一个**学生的 Google 号**（不是你自己的管理员号）登录，然后：

1. 能不能登进来 → 验证授权域名加对了
2. 看得到 Part 2 六个主题、看不到 Part 1 → 验证隔离生效
3. 录一段，应该提示"跟老师说一声开通" → 验证试用分层
4. 你在后台把这个邮箱加进名单，他那边**不用刷新**就变成已开通 → 验证实时生效
5. 再录一段并提交 → **这是唯一还没被实测过的一环**，通了说明录音存储真的修好了
