# Nova English Club · Trinity GESE B1 Portal

朗思/Trinity GESE B1 口语备考站：Part 1 题库 + 听力 drill + 学生录音提交 + 老师批改后台。

React 19 + Vite + Tailwind 4 + Firebase（Auth / Firestore / Storage），外层套一个 Express
（`server.ts`）负责调用 Gemini 做 TTS 和发音点评——**Gemini key 只在服务端，不会进前端 bundle。**

## 本地跑起来

```bash
npm install
cp .env.example .env    # 然后填 GEMINI_API_KEY
npm run dev             # http://localhost:3000
```

`npm run dev` 跑的是 `server.ts`（Express + Vite 中间件），不是 `vite dev`。
两者的区别是：只有前者才有 `/api/*` 接口和考官音频的按需生成。

## 环境变量

| 变量 | 用途 |
| --- | --- |
| `GEMINI_API_KEY` | 只用于服务端 TTS（`gemini-3.1-flash-tts-preview`）生成考官提问音频。缺了不影响网站打开，只是没有 AI 语音，前端会自动退回浏览器自带 TTS。 |
| `ADMIN_EMAILS` | 允许调用 `/api/admin/*` 的老师邮箱，逗号分隔。**要和 `firestore.rules` 里的 `isV1Admin()` 保持一致。** |

## 考官音频

题库里每道题都指向一个 wav 文件：

- `src/constants.ts` 里的静态题 → `/audio/part1/<id>.wav`
- 老师在后台导入的 globalTopics 题 → `/audio/<id>.wav`

生成方式有两种：

```bash
npx tsx scripts/generate_part1_audio.ts   # 批量预生成 constants.ts 里的题
```

或者跑着 dev server 时直接请求缺失的文件，`server.ts` 会拦截并现场生成一份存到
`public/audio/`。

⚠️ **`public/audio/` 没有进 git。** 部署到容器（Cloud Run 之类）上时，容器一重启这些文件
就没了，每次冷启动都要重新烧 Gemini 配额。正式上线前建议先本地全量生成，再把 wav 推到
CDN，把题库里的路径换成 CDN 绝对地址。

## 权限模型

- 老师身份**只认邮箱**，硬编码在两个地方：`firestore.rules` 的 `isV1Admin()` 和服务端的
  `ADMIN_EMAILS`。前端的 `isAdmin` 只用来决定画不画后台 UI，不作数。
- 不要改成"读用户文档里的 role 字段判管理员"——学生对自己那条 `users/{uid}` 文档有写权限，
  那样能被绕过。
- `/api/admin/*` 要求请求头带 Firebase ID token，服务端会向 Identity Toolkit 验证。

## Firestore 数据库

`firebase-applet-config.json` 里的 `firestoreDatabaseId` 决定 app 连哪个数据库。
**AI Studio 会在改代码时把这个字段改回它自己创建的 `ai-studio-*` 数据库**，而
`firestore.rules` 通常发布在 `(default)` 上——两边一旦不一致，登录正常、题库正常，但所有
读写都会 `Missing or insufficient permissions`。

排查顺序：Firebase 控制台 → Firestore → 看数据库列表里有几个库 → 确认 app 连的那个库上
有没有发布规则。（规则粘进编辑器后必须点「发布」才生效。）
