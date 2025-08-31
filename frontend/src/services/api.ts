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
  tests?: { question: string; options: string[]; correct: number[]; hint?: string; explanation?: string }[];
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

export async function updateTaskPassed(chatId: number, topic: string, index: number, passed: boolean): Promise<GenerateTasksResponse> {
  const res = await fetch(`${API_URL}/trajectory/tasks/passed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, topic, index, passed }),
  });
  if (!res.ok) throw new Error("Failed to update task passed status");
  return (await res.json()) as GenerateTasksResponse;
}
// end
