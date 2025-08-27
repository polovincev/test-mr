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
export interface TrajectorySkill {
  name: string;
  recommended_level: number;
  description?: string | null;
}

export interface TrajectoryItem {
  title: string;
  description?: string | null;
  tags?: string | null;
  skills: TrajectorySkill;
}

export async function getTrajectory(): Promise<TrajectoryItem[]> {
  const res = await fetch(`${API_URL}/trajectory/`);
  if (!res.ok) throw new Error("Failed to load trajectory");
  return (await res.json()) as TrajectoryItem[];
}
// end
