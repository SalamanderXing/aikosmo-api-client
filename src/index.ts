import ky from "ky";
import { ChatbotDataSchema, ChatbotData, ChatMessage } from "./types";

function isValidUUIDv4(str: string): boolean {
  const uuidv4Regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidv4Regex.test(str);
}

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

export type { ChatbotData, ChatMessage };

export class ChatbotApi {
  private userId: string | null = null;
  private websocket: WebSocket | null = null;
  onChecking: (() => Promise<void>) | null = null;
  onDoneChecking: (() => Promise<void>) | null = null;
  onError: (() => Promise<void>) | null = null;

  constructor(
    private sourceUrl: string,
    private chatbotSlug: string,
    private hiddenChat: boolean
  ) {
    assert(typeof hiddenChat === "boolean", "Invalid hidden chat");
    assert(typeof chatbotSlug === "string", "Invalid chatbot slug");
    assert(typeof sourceUrl === "string", "Invalid source URL");
    this.userId = localStorage.getItem(`userId-${chatbotSlug}`);
    if (this.userId != null && !isValidUUIDv4(this.userId)) {
      this.userId = null;
    } else {
      console.log("USER ID", this.userId);
    }
  }

  async newChat(): Promise<void> {
    if (this.websocket === null) {
      await this.setupWebSocket();
    }
    if (!this.websocket) {
      throw new Error("WebSocket connection not established");
    }
    this.websocket?.send(JSON.stringify({ type: "clientCreatedNewChat" }));
    return new Promise<void>((resolve, reject) => {
      const timeoutDuration = 10000; // 10 seconds timeout
      const timeoutId = setTimeout(() => {
        reject(
          new Error("Timeout: Server did not respond with newChatCreated")
        );
      }, timeoutDuration);

      const messageHandler = (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        if (data.type === "newChatCreated") {
          clearTimeout(timeoutId);
          this.websocket?.removeEventListener("message", messageHandler);
          resolve();
        }
      };
      this.websocket?.addEventListener("message", messageHandler);
    });
  }

  async getChatConfig(): Promise<ChatbotData> {
    console.log("INIT CHAT");
    const params = {
      language: (navigator.language || "en-US").split("-")[0],
      hiddenChat: this.hiddenChat.toString(),
    } as Record<string, string>;

    if (this.chatbotSlug) {
      params.chatbotSlug = this.chatbotSlug;
    }

    if (this.userId) {
      params.userId = this.userId;
    }
    const responseJson = await ky
      .get<ChatbotData>(`${this.sourceUrl}/api/get_config`, {
        searchParams: params,
      })
      .json();

    console.log(responseJson);
    if (this.userId !== responseJson.userId) {
      console.log("UPDATING user ID", responseJson.userId);
      this.userId = responseJson.userId;
      localStorage.setItem(`userId-${this.chatbotSlug}`, responseJson.userId);
    }
    console.log("HISTORY");
    console.log(responseJson.history);
    if (responseJson.history.length > 0) {
      // Put the intro message before the actual messages
      const introMessageObj = {
        role: "assistant",
        content: responseJson.introMessage[params.language],
      } as ChatMessage;
      responseJson.history.unshift(introMessageObj);
    }
    console.log("Response JSON keys:", Object.keys(responseJson));
    console.log(responseJson.popupMessageTitle);
    console.log(responseJson.popupMessage);
    console.log(responseJson.suggestedQuestions);
    return ChatbotDataSchema.parse(responseJson);
  }

  private async setupWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const MAX_RETRIES = 0;
      let retryCount = 0;

      const connect = () => {
        const wsUrl = new URL(this.sourceUrl);
        wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
        wsUrl.searchParams.append("userId", this.userId || "");
        wsUrl.searchParams.append("chatbotSlug", this.chatbotSlug);
        wsUrl.searchParams.append(
          "language",
          (navigator.language || "en-US").split("-")[0]
        );
        wsUrl.searchParams.append("hiddenChat", this.hiddenChat.toString());

        this.websocket = new WebSocket(wsUrl.toString());

        this.websocket.onopen = () => {
          console.log("WebSocket connection established");
          resolve();
        };

        this.websocket.onerror = async (error) => {
          console.error("WebSocket connection error:", error);
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            console.log(
              `Retrying connection (attempt ${retryCount}/${MAX_RETRIES})...`
            );
            try {
              connect(); // Retry connection with new token
            } catch (refreshError) {
              reject(refreshError);
            }
          } else {
            const errorMessage = `Failed to establish WebSocket connection after ${MAX_RETRIES} attempts`;
            console.error(errorMessage);
            // Clear local storage
            localStorage.removeItem(`chatbotToken-${this.chatbotSlug}`);
            localStorage.removeItem(`userId-${this.chatbotSlug}`);
            this.userId = null;
            reject(new Error(errorMessage));
          }
        };

        this.websocket.onclose = (event) => {
          console.log("WebSocket connection closed", event);
          this.websocket = null;
          if (event.code !== 1000) {
            console.log("Attempting to reconnect...");
            setTimeout(connect, 10000);
          }
        };
      };

      connect();
    });
  }

  async fetchChatResponse({
    newMessage,
    onNewChunk,
    onDone,
  }: {
    newMessage: string;
    onNewChunk: (chunk: string) => Promise<void>;
    onDone: () => Promise<void>;
  }) {
    if (this.websocket === null) {
      await this.setupWebSocket();
    }
    if (!this.websocket) {
      throw new Error("WebSocket connection not established");
    }
    console.log("SENDING MESSAGE");
    this.websocket.send(
      JSON.stringify({ type: "clientSentMessage", message: newMessage })
    );
    console.log("MESSAGE SENT");

    return new Promise<void>((resolve, reject) => {
      if (!this.websocket) {
        reject(new Error("WebSocket connection not established"));
        return;
      }

      let hasReceivedResponse = false;
      const timeoutDuration = 120000; // 60 seconds

      const timeoutId = setTimeout(async () => {
        if (!hasReceivedResponse) {
          const errorMessage = "Server took too long to start the reply stream";
          console.error(errorMessage);
          if (this.onError) {
            await this.onError();
          }
          reject(new Error(errorMessage));
        }
      }, timeoutDuration);

      this.websocket.onmessage = async (event) => {
        hasReceivedResponse = true;
        clearTimeout(timeoutId);
        const chunk = JSON.parse(event.data) as {
          type: string;
          message?: string;
          functionName?: string;
        };
        console.log("CHUNK", chunk);
        if (
          chunk.type === "functionCallBegin" &&
          chunk.functionName === "fetch_room_availability" &&
          this.onChecking
        ) {
          await this.onChecking();
        } else if (
          chunk.type === "functionCallEnd" &&
          chunk.functionName === "fetch_room_availability" &&
          this.onDoneChecking
        ) {
          await this.onDoneChecking();
        } else if (chunk.type === "streamingDone") {
          await onDone();
          resolve();
        } else if (chunk.type === "error") {
          if (this.onError) {
            await this.onError();
          }
          reject(new Error(chunk.message));
        } else if (chunk.message && chunk.message.length > 0) {
          if (chunk.type === "serverSentMessageChunk") {
            await onNewChunk(chunk.message);
          }
        }
      };
      this.websocket.onerror = async (error) => {
        clearTimeout(timeoutId);
        console.error("WebSocket error during message processing:", error);
        if (this.onError) {
          await this.onError();
        }
        reject(error);
      };

      this.websocket.onclose = async () => {
        clearTimeout(timeoutId);
        await onDone();
        resolve();
      };
    });
  }
}
