# 上线清单

新的 Firebase 项目已经建好并配置完毕，在你自己的账号 `xuanyu.diao@gmail.com` 下。
剩下的都是控制台里点几下，加一条命令。

## 已经做好的

| | |
| --- | --- |
| Firebase 项目 | **`nova-english-b1`**（你自己账号下） |
| Firestore | `(default)` 数据库，欧洲多区域 `eur3` |
| 安全规则 | **已发布**，编译通过 |
| Web 应用 | 已注册，config 已写进 `firebase-applet-config.json` |
| Vercel 配置 | `vercel.json` 就绪，CLI 已登录 `mingzihaonan12138` |

控制台：https://console.firebase.google.com/project/nova-english-b1/overview

旧项目 `gen-lang-client-0538041967` 不再使用。它在别人账号下，我们拿不到权限，
而它里面几乎没有数据可惜——录音一条都没存成（Storage 桶不存在），
学生档案一条都没建成（`bindUserOnLogin` 的查询被规则拒）。

---

## 还剩三步

### 1. 打开 Google 登录（控制台，约 30 秒）

https://console.firebase.google.com/project/nova-english-b1/authentication

点「开始使用」→ 选 **Google** → 打开开关 → 选一个「项目支持电子邮件」→ 保存。

这一步只能你来：它要创建一个 OAuth 客户端，需要填应用名称和支持邮箱，
是你的品牌信息。**免费版就能开**，不需要绑卡。

（我试过用 API 自动开，返回 `BILLING_NOT_ENABLED` —— 那条路会把你拽到付费版，
所以我停下了，没有触发任何计费。）

### 2. 部署到 Vercel

在仓库目录：

```bash
npx vercel --prod
```

### 3. 把 Vercel 域名加进授权域名（控制台）

拿到 `xxx.vercel.app` 之后：

Authentication → Settings → **授权域名** → 添加。

不加的话 Google 登录会报 `auth/unauthorized-domain`，谁都进不来。

---

## 上线后第一件要验证的

用一个**学生的 Google 号**（不是你的管理员号）登录：

1. 能登进来 → 授权域名加对了
2. 看得到 Part 2 六个主题、看不到 Part 1 → 隔离生效
3. 录一段，提示"跟老师说一声开通" → 试用分层生效
4. 你在后台把这个邮箱加进名单，他那边**不用刷新**就变成已开通 → 实时生效
5. 再录一段并提交 → **整条链路唯一还没实测过的一环**，通了说明录音存储真修好了

---

## 考官音频（不急，不阻塞上线）

`server.ts` 的按需生成音频在 Vercel 上不能用——无服务器函数没有持久磁盘。
线上目前找不到音频就回退浏览器 TTS，能用但不是 Sonia 那种质量。

正式方案照搬 B2：本地 `npx tsx scripts/generate_part1_audio.ts` 全量生成，
推到 CDN 仓库走 jsDelivr，题库里换成绝对地址。
