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
