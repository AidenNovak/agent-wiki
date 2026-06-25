import { createOpenAI } from "@ai-sdk/openai";
import { streamText, jsonSchema, stepCountIs, convertToModelMessages } from "ai";
import { listDir, readFile, grepFiles, getWiki, DirEntry } from "@/lib/fs-tools";
import { getAllAgents } from "@/lib/agents";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const _deepseekProvider = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY ?? "",
  baseURL: "https://api.deepseek.com/v1",
});
// ai-sdk v6 defaults to OpenAI Responses API (/v1/responses) which DeepSeek does not support.
// Use .chat() to force the Chat Completions path (/v1/chat/completions).
const deepseek = (modelId: string) => _deepseekProvider.chat(modelId);

const AGENTS = getAllAgents();
const AGENT_MAP = Object.fromEntries(AGENTS.map((a) => [a.name, a]));

const SYSTEM_PROMPT = `You are an expert AI agent code analyst with deep knowledge of AI coding assistants and agent architectures.

## Your Role
You help users explore, understand, and compare AI agent source code repositories. You can browse the actual source code, read files, and search for patterns. You have detailed wiki summaries for each agent.

## Available Agent Repos (source code is local)
${AGENTS.map((a) => `- **${a.name}** (${a.category}): ${a.description}\n  Dir: ${a.dir}`).join("\n")}

## Tools at Your Disposal
- **ls_directory**: List files/directories in a path (use depth 2-3 for overview, 1 for quick scan)
- **read_file**: Read file contents (auto-truncated at 100KB)
- **grep_files**: Search for patterns across files using ripgrep
- **get_wiki**: Get the pre-generated architecture wiki for an agent (always start here for a new agent)

## Guidelines
1. **Start with the wiki** when asked about an agent — it contains architecture diagrams and tech stack details
2. **Use ls_directory** to explore the repo structure before diving into files
3. **For comparisons**, read both wikis first, then explore specific files to validate
4. **Be specific**: point to exact files and line numbers when relevant
5. **Mermaid diagrams**: the wiki files contain Mermaid architecture diagrams — mention them
6. **Keep responses concise** but technically precise
7. Use Chinese for explanations if the user writes in Chinese

## Base Directory
All repos live under: /Users/lijixiang/repo/history/

## Key Patterns to Look For
- Agent loop implementation (main reasoning loop)
- Tool/function calling mechanism
- LLM provider abstraction
- File system and shell tool implementations
- Memory/context management
- Plugin/extension system`;

function formatTree(entries: DirEntry[], indent = ""): string {
  return entries.map((e) => {
    const icon = e.type === "dir" ? "📁" : "📄";
    const size = e.size ? ` (${(e.size / 1024).toFixed(1)}KB)` : "";
    let line = `${indent}${icon} ${e.name}${size}`;
    if (e.children?.length) {
      line += "\n" + formatTree(e.children, indent + "  ");
    }
    return line;
  }).join("\n");
}

export async function POST(req: Request) {
  const { messages, agentContext } = await req.json();

  let systemPrompt = SYSTEM_PROMPT;
  if (agentContext?.length) {
    const ctx = (agentContext as string[])
      .map((name: string) => AGENT_MAP[name])
      .filter(Boolean)
      .map((a) => `Active agent: ${a.name} at ${a.dir}`)
      .join("\n");
    systemPrompt += `\n\n## Currently Active in IDE\n${ctx}`;
  }

  // ai v6: useChat sends UIMessage[]; streamText needs ModelMessage[]
  // convertToModelMessages is sync in runtime but types it as async-compatible
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelMessages = await Promise.resolve(convertToModelMessages(messages as any));

  const result = streamText({
    model: deepseek("deepseek-v4-flash"),
    system: systemPrompt,
    messages: modelMessages,
    tools: {
      ls_directory: {
        description: "List files and directories. Use depth=1 for shallow, depth=2-3 for deeper tree.",
        inputSchema: jsonSchema<{ path: string; depth: number }>({
          type: "object",
          properties: {
            path: { type: "string", description: "Absolute path to directory" },
            depth: { type: "number", description: "Tree depth (1-4)", default: 2 },
          },
          required: ["path"],
        }),
        execute: async ({ path, depth = 2 }: { path: string; depth?: number }) => {
          const entries = listDir(path, Math.min(depth, 4));
          return formatTree(entries) || "(empty directory)";
        },
      },

      read_file: {
        description: "Read the contents of a file. Auto-truncated at 100KB.",
        inputSchema: jsonSchema<{ path: string }>({
          type: "object",
          properties: {
            path: { type: "string", description: "Absolute path to file" },
          },
          required: ["path"],
        }),
        execute: async ({ path }: { path: string }) => readFile(path),
      },

      grep_files: {
        description: "Search for a pattern in files using ripgrep. Returns matching files and line excerpts.",
        inputSchema: jsonSchema<{ dir: string; pattern: string }>({
          type: "object",
          properties: {
            dir: { type: "string", description: "Directory to search in" },
            pattern: { type: "string", description: "Search pattern (regex or literal)" },
          },
          required: ["dir", "pattern"],
        }),
        execute: async ({ dir, pattern }: { dir: string; pattern: string }) => grepFiles(dir, pattern),
      },

      get_wiki: {
        description: "Get the pre-generated architecture wiki/report for an agent. Always call this first when asked about a specific agent.",
        inputSchema: jsonSchema<{ agent_name: string }>({
          type: "object",
          properties: {
            agent_name: { type: "string", description: "Agent name, e.g. 'opencode', 'cline', 'Kun'" },
          },
          required: ["agent_name"],
        }),
        execute: async ({ agent_name }: { agent_name: string }) => {
          const agent = AGENT_MAP[agent_name];
          if (!agent) {
            return `Agent '${agent_name}' not found. Available: ${Object.keys(AGENT_MAP).join(", ")}`;
          }
          return getWiki(agent.wikiPath);
        },
      },
    },
    stopWhen: stepCountIs(10),
  });

  return result.toUIMessageStreamResponse();
}
