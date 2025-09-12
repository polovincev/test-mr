import { API_URL } from "../config";

export interface MessageResponse {
  content: string;
}

export async function getMessage(): Promise<MessageResponse> {
  const response = await fetch(`${API_URL}/message`);
  if (!response.ok) {
    throw new Error("Network response was not ok");
  }
  return (await response.json()) as MessageResponse;
}

export interface FactResponse {
  content: string;
}

export async function getFact(): Promise<FactResponse> {
  const response = await fetch(`${API_URL}/fact`);
  if (!response.ok) {
    throw new Error("Network response was not ok");
  }
  return (await response.json()) as FactResponse;
}

// Chat API
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  suggestions: { label: string; action: "redirect" | "send_message"; href?: string; message?: string }[];
}

export interface Chat {
  id: number;
  title: string;
  messages: ChatMessage[];
}

export interface ChatSummary {
  id: number;
  title: string;
}

export async function createChat(title: string, mode: "goal" | "direct" | "profile_goal" = "goal", firstUserPrompt?: string): Promise<Chat> {
  const res = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, mode, first_user_prompt: firstUserPrompt }),
  });
  if (!res.ok) throw new Error("Failed to create chat");
  return (await res.json()) as Chat;
}

export async function getChat(chatId: number): Promise<Chat> {
  const res = await fetch(`${API_URL}/chat/${chatId}`);
  if (!res.ok) throw new Error("Failed to get chat");
  return (await res.json()) as Chat;
}

export async function sendMessage(chatId: number, content: string, role: "user" | "assistant" = "user"): Promise<Chat> {
  const res = await fetch(`${API_URL}/chat/${chatId}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, content }),
  });
  if (!res.ok) throw new Error("Failed to send message");
  return (await res.json()) as Chat;
}

export async function listChats(): Promise<ChatSummary[]> {
  const res = await fetch(`${API_URL}/chat/`);
  if (!res.ok) throw new Error("Failed to list chats");
  return (await res.json()) as ChatSummary[];
}

// -------- Skills API --------
export interface SkillPoint {
  name: string;
  level: number;
  description?: string;
}

export interface SkillsResponse {
  items: SkillPoint[];
}

export async function getSkills(): Promise<SkillsResponse> {
  const res = await fetch(`${API_URL}/skills/`);
  if (!res.ok) throw new Error("Failed to load skills");
  return (await res.json()) as SkillsResponse;
}
// -------- Trajectory API --------
export interface SkillLevelInfo {
  level: number;
  level_name?: string | null;
  meta?: string | null;
  description?: string | null;
  tasks?: { title: string; description?: string | null }[];
}

export interface TrajectorySkill {
  name: string;
  recommended_level: number;
  recommended_level_text?: string | null;
  levels?: SkillLevelInfo[];
  user_level?: number; // new: current user level (default 0.1)
  goal_level?: number; // new: goal level for user (default 0.1)
}

export interface TrajectoryItem {
  title: string;
  description?: string | null;
  tags?: string | null;
  skills: TrajectorySkill;
  image_url?: string | null;
}

export interface TrajectoryResponse {
  goal: string;
  items: TrajectoryItem[];
}

export async function getTrajectory(chatId?: number): Promise<TrajectoryResponse> {
  const url = `${API_URL}/trajectory/${chatId ? `?chat_id=${chatId}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load trajectory");
  return (await res.json()) as TrajectoryResponse;
}

export async function updateGoalLevels(chatId: number, levels: number[]): Promise<TrajectoryResponse> {
  const res = await fetch(`${API_URL}/trajectory/goal_levels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, levels }),
  });
  if (!res.ok) throw new Error("Failed to update goal levels");
  return (await res.json()) as TrajectoryResponse;
}

export interface GeneratedTask {
  title: string;
  level: number;
  content_md: string;
  questions_to_consider?: { question: string; answer?: string }[];
  tests?: { question: string; options: string[]; correct: number[]; hint?: string; explanation?: string; answer?: number[] }[];
  payload?: Record<string, unknown>;
  passed?: boolean;
}

export interface GenerateTasksResponse {
  chat_id?: number;
  topic?: string;
  goal?: string;
  level?: number;
  tasks: GeneratedTask[];
}

export async function generateTasks(chatId: number, topic: string): Promise<GenerateTasksResponse> {
  const res = await fetch(`${API_URL}/trajectory/generate_tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, topic }),
  });
  if (!res.ok) throw new Error("Failed to generate tasks");
  return (await res.json()) as GenerateTasksResponse;
}

export type TestAnswerPayload = { index: number; answer: number[] };

export async function updateTaskPassed(
  chatId: number,
  topic: string,
  index: number,
  passed: boolean,
  answer?: TestAnswerPayload[]
): Promise<GenerateTasksResponse> {
  const res = await fetch(`${API_URL}/trajectory/tasks/passed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, topic, index, passed, ...(Array.isArray(answer) ? { answer } : {}) }),
  });
  if (!res.ok) throw new Error("Failed to update task passed status");
  return (await res.json()) as GenerateTasksResponse;
}

// -------- Meta Expand API --------
export interface MetaExpandItem { title: string; expansions: string[] }
export interface MetaExpandResponse { chat_id: number; items: MetaExpandItem[] }

export async function metaExpand(chatId: number): Promise<MetaExpandResponse> {
  const res = await fetch(`${API_URL}/trajectory/meta_expand`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId }),
  });
  if (!res.ok) throw new Error("Failed to expand meta");
  return (await res.json()) as MetaExpandResponse;
}

// New extended meta endpoint
export async function metaExtendNew(chatId: number, topic: string): Promise<MetaExpandResponse> {
  const res = await fetch(`${API_URL}/trajectory/meta_extend_new`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, topic }),
  });
  if (!res.ok) throw new Error("Failed to meta-extend");
  return (await res.json()) as MetaExpandResponse;
}

// Single-item trajectory by topic
export async function getTrajectoryByTopic(chatId: number, topic: string): Promise<TrajectoryResponse> {
  const res = await fetch(`${API_URL}/trajectory/by_topic`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, topic })
  });
  if (!res.ok) throw new Error("Failed to load topic trajectory");
  return (await res.json()) as TrajectoryResponse;
}

export async function updateByTopicGoalLevel(chatId: number, topic: string, level: number): Promise<TrajectoryResponse> {
  const res = await fetch(`${API_URL}/trajectory/by_topic/goal_level`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, topic, level })
  });
  if (!res.ok) throw new Error("Failed to update by_topic goal level");
  return (await res.json()) as TrajectoryResponse;
}

export async function generateTasksByTopic(chatId: number, topic: string): Promise<GenerateTasksResponse> {
  const res = await fetch(`${API_URL}/trajectory/by_topic/generate_tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, topic })
  });
  if (!res.ok) throw new Error("Failed to generate tasks by topic");
  return (await res.json()) as GenerateTasksResponse;
}
// -------- Meta Central API --------
export interface MetaCentralResponse { chat_id: number; content: string }

export async function metaCentral(chatId: number): Promise<MetaCentralResponse> {
  const res = await fetch(`${API_URL}/meta/central`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId }),
  });
  if (!res.ok) throw new Error("Failed to load meta central");
  return (await res.json()) as MetaCentralResponse;
}
// end

export interface SummaryMessage { role: "user" | "assistant"; content: string }
export interface SummaryChatOut { chat_id: number; messages: SummaryMessage[] }

export async function startSummaryChat(chatId: number): Promise<SummaryChatOut> {
  const res = await fetch(`${API_URL}/summary_chat/start?chat_id=${chatId}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to start summary chat");
  return (await res.json()) as SummaryChatOut;
}

export async function sendSummaryMessage(chatId: number, content: string): Promise<SummaryChatOut> {
  const res = await fetch(`${API_URL}/summary_chat/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, content })
  });
  if (!res.ok) throw new Error("Failed to send summary message");
  return (await res.json()) as SummaryChatOut;
}
// end
