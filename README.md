# 周报 Agent

基于 [eve](https://eve.dev) 框架的本地周报助手:读取本地 git 仓库的提交记录,按固定格式生成中文周报,经确认后写入 `reports/` 目录。项目列表可交互式新增/删除并持久化。

> ⚠️ 这个 agent 读的是**本地 git 仓库**,所以它跑在每个人自己的机器上,不适合部署成多人共用的 web 服务。

## 功能

- 拉取本地 git 提交(按时间窗 + 作者 `git config user.name` 过滤)
- 多项目按项目分节,无提交显示「无」
- 交互式多选项目、新增项目、选时间窗、确认生成
- 生成周报写入 `reports/周报-YYYY-MM-DD.md`,写文件前 y/n 确认
- 项目列表持久化在 `projects.json`,可跨会话复用

## 环境要求

- **Node.js 24 或更新**(必须,不能用 bun)
- 一个 [DeepSeek API key](https://platform.deepseek.com/api_keys)

> 为什么不能用 bun:eve 的 dev worker 用 crossws 的 Node 适配器,在 bun 下会报 `[crossws] Using Node.js adapter in an incompatible environment.`。请用 Node 24。

## 快速开始

```bash
# 1. 切到 Node 24(系统装了 nvm 的话)
nvm use 24

# 2. 安装依赖(用 npm,不要用 bun)
npm install

# 3. 交互式配置 DeepSeek API key(写入 .env,已 gitignore)
npm run setup

# 4. 启动本地 TUI
npm run dev
```

启动后在提示符里输入「生成周报」即可开始。

## 配置

### DeepSeek API key

两种方式任选:

- **交互式(推荐)**:`npm run setup`,按提示粘贴 key,自动写入 `.env`。
- **手动**:复制 `.env.example` 为 `.env`,填入 `DEEPSEEK_API_KEY=sk-...`。

`.env` 已被 `.gitignore` 忽略,不会入库。改了 `.env` 后重启 `npm run dev` 才生效(`--env-file-if-exists` 只在进程启动时加载一次)。

### 项目列表

项目注册表存在项目根目录的 `projects.json`(已 gitignore),格式:

```json
{
  "projects": [
    { "name": "线上崂山 - 管理后台", "path": "/abs/path/to/repo" }
  ]
}
```

- `name`:周报里【项目名称】的展示名。
- `path`:本地 git 仓库的**绝对路径**。

既可以在对话里用工具增删,也可以直接编辑这个文件。可用环境变量 `WEEKLY_PROJECTS_FILE` 覆盖其路径。

## 使用流程

在 TUI 里输入「生成周报」后,agent 会按下面的步骤一步步跟你交互:

1. **列出项目** -> 调 `list_projects`
2. **多选项目** -> 列出编号,你输 `1,3` 多选(中英文逗号、空格都行),或选「全部项目」/「新增项目」
3. **新增项目(按需)** -> 依次问项目名 + 本地仓库绝对路径,调 `add_project` 校验后加入,再回第 2 步重选
4. **选时间窗** -> 本周(默认,周一到今天)/ 上周 / 最近 7 天
5. **拉取提交** -> 对选中的每个项目并行调 `list_commits`
6. **起草周报** -> 按格式生成
7. **补充本周计划(可选)** -> 你补充本周计划;跳过则写「无」
8. **确认生成** -> 选「确认写入文件」/「我要修改」/「取消」;确认后调 `write_report`,再弹一次 y/n 才真正写盘

> 多选是输编号(`1,3`)而不是空格勾选--eve 的 TUI 提问组件只支持单选/自由输入,不支持按空格多选。

## 周报格式

```
上周工作总结
【项目名称】【任务概览(不超过 15 字)】【迭代周期-先留空待用户补充】

  任务一：……

  任务二：……

(每个项目一个【...】分节;某项目无提交则该节写「无」)

本周工作计划
1、……
2、……

风险点：
无

举措：
无
```

## 工具

agent 自带这些工具(文件名即工具名):

| 工具 | 作用 |
| --- | --- |
| `list_projects` | 列出已注册项目 |
| `add_project` | 新增项目(校验是否 git 仓库) |
| `remove_project` | 删除项目(按名称或路径) |
| `list_commits` | 拉取提交(按时间窗 + 作者过滤) |
| `write_report` | 写周报到 `reports/`,每次写前 y/n 确认 |

另有 eve 内置的 `ask_question`(交互提问)等。

## 项目结构

```
my-agent/
├── agent/
│   ├── agent.ts            # 模型配置(DeepSeek),key 从 env 读
│   ├── instructions.md     # 系统提示(周报流程 + 格式)
│   ├── channels/eve.ts     # eve 通道
│   ├── tools/              # 工具(list_commits / add_project / ...)
│   └── lib/                # 共享代码(dates / projects / git)
├── scripts/setup-env.mjs   # 交互式配置 DeepSeek key
├── .env.example            # 环境变量模板(入库)
├── .env                    # 你的 key(本地,不入库)
├── projects.json           # 项目注册表(本地,不入库)
├── reports/                # 生成的周报(本地,不入库)
└── package.json
```

## npm 脚本

| 脚本 | 作用 |
| --- | --- |
| `npm run dev` | 启动本地 TUI(自动加载 `.env`) |
| `npm run setup` | 交互式配置 DeepSeek key |
| `npm run build` | 构建可部署产物到 `.output/` |
| `npm run start` | 运行构建产物(服务端,无 TUI) |
| `npm run typecheck` | TypeScript 类型检查 |

## 常见问题

**`bun run dev` 报 `[crossws] Using Node.js adapter in an incompatible environment.`**
用 Node 24 跑(`nvm use 24 && npm run dev`),不要用 bun。

**`MODEL_CALL_FAILED: Authorization Required`(401)**
`.env` 没配 key 或 key 无效。运行 `npm run setup` 填入有效 key,然后**重启** `npm run dev`。

**改了 `.env` 或 `projects.json` 没生效**
`.env` 改完要重启 `npm run dev`。`projects.json` 是工具实时读写的,改完即生效。

**agent 没按新流程走**
`eve dev` 会监视 `agent/` 文件并自动重建;没生效就重启一次 `npm run dev`。

## 安全

- `.env`、`projects.json`、`reports/` 都已加入 `.gitignore`,不会入库。
- 不要把 DeepSeek key 提交到仓库。如果 key 曾泄露(比如在 git 历史里),去 DeepSeek 后台吊销/轮换,再用 `git filter-repo` 清理历史。
