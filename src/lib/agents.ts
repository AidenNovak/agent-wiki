import fs from "fs";
import path from "path";

export const HISTORY_ROOT = process.env.HISTORY_ROOT ?? "/Users/lijixiang/repo/history";

export interface AgentMeta {
  name: string;
  category: "agent" | "collaboration" | "frontend-render";
  dir: string;       // absolute path to source repo
  wikiPath: string;  // absolute path to wiki .md
  description: string;
  url?: string;
}

// Static manifest built from README descriptions
const AGENTS_RAW: Omit<AgentMeta, "dir" | "wikiPath">[] = [
  { name: "opencode",        category: "agent",         description: "开源 AI 编程 agent，支持多模型后端",                   url: "https://github.com/anomalyco/opencode" },
  { name: "cline",           category: "agent",         description: "VS Code 扩展形式的 AI 编程助手 agent",                 url: "https://github.com/cline/cline" },
  { name: "aider",           category: "agent",         description: "基于 Git 的 AI 编程 agent，支持代码修改与版本管理",    url: "https://github.com/Aider-AI/aider" },
  { name: "codex",           category: "agent",         description: "OpenAI 的代码生成模型与 agent 示例",                   url: "https://github.com/openai/codex" },
  { name: "OpenHands",       category: "agent",         description: "通用 AI 软件工程 agent，可自主编写、测试和修复代码",   url: "https://github.com/OpenHands/OpenHands" },
  { name: "gemini-cli",      category: "agent",         description: "Google Gemini 模型的命令行接口 agent",                 url: "https://github.com/google-gemini/gemini-cli" },
  { name: "openinterpreter", category: "agent",         description: "自然语言驱动的计算机控制 agent，可执行代码和系统操作", url: "https://github.com/openinterpreter/openinterpreter" },
  { name: "kimi-code",       category: "agent",         description: "Moonshot AI 的代码 agent，专注长上下文理解",           url: "https://github.com/MoonshotAI/kimi-code" },
  { name: "qwen-code",       category: "agent",         description: "基于 Qwen 模型的代码生成与理解 agent",                 url: "https://github.com/QwenLM/qwen-code" },
  { name: "pi",              category: "agent",         description: "轻量级 agent 框架，专注于快速原型开发与交互式任务",    url: "https://github.com/earendil-works/pi" },
  { name: "Kun",             category: "collaboration", description: "多 agent 协作框架，支持动态角色与任务分配",            url: "https://github.com/KunAgent/Kun" },
  { name: "multica",         category: "collaboration", description: "多智能体协作框架，支持复杂任务分解与分布式执行",       url: "https://github.com/multica-ai/multica" },
];

export function getAllAgents(): AgentMeta[] {
  return AGENTS_RAW.map((a) => ({
    ...a,
    dir: path.join(HISTORY_ROOT, a.category, a.name),
    wikiPath: path.join(HISTORY_ROOT, "wiki", a.category, `${a.name}.md`),
  })).filter((a) => {
    try { fs.accessSync(a.dir); return true; } catch { return false; }
  });
}

export function getAgent(name: string): AgentMeta | undefined {
  return getAllAgents().find((a) => a.name === name);
}
