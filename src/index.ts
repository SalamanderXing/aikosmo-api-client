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

const isValidHttpUrl = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:";
  } catch {
    return false;
  }
};

export type { ChatbotData, ChatMessage };
export { ChatbotDataSchema };

export class ChatbotApi {
  private websocket: WebSocket | null = null;
  onCheckingAvailability: (() => Promise<void>) | null = null;
  onDoneCheckingAvailability: (() => Promise<void>) | null = null;
  onError: (() => Promise<void>) | null = null;
  sourceUrl: string;
  chatbotSlug: string;
  hiddenChat: boolean;
  restoreChat: boolean;
  userId: string | null;
  logEnabled: boolean;

  constructor({
    sourceUrl,
    chatbotSlug,
    hiddenChat,
    restoreChat = true,
    userId = null,
    onCheckingAvailability = null,
    onDoneCheckingAvailability = null,
    onError = null,
    logEnabled = true,
  }: {
    sourceUrl: string;
    chatbotSlug: string;
    hiddenChat: boolean;
    restoreChat?: boolean;
    userId?: string | null;
    onCheckingAvailability?: (() => Promise<void>) | null;
    onDoneCheckingAvailability?: (() => Promise<void>) | null;
    onError?: (() => Promise<void>) | null;
    logEnabled?: boolean;
  }) {
    assert(isValidHttpUrl(sourceUrl), "Invalid source URL");
    assert(typeof hiddenChat === "boolean", "Invalid hidden chat");
    assert(typeof chatbotSlug === "string", "Invalid chatbot slug");
    assert(typeof restoreChat === "boolean", "Invalid restore chat");
    assert(typeof logEnabled === "boolean", "Invalid log enabled");

    this.sourceUrl = sourceUrl;
    this.chatbotSlug = chatbotSlug;
    this.hiddenChat = hiddenChat;
    this.restoreChat = restoreChat;
    this.userId = userId;
    this.onCheckingAvailability = onCheckingAvailability;
    this.onDoneCheckingAvailability = onDoneCheckingAvailability;
    this.onError = onError;
    this.logEnabled = logEnabled;
    if (typeof window !== "undefined" && window.localStorage) {
      this.userId =
        this.userId ?? localStorage.getItem(`userId-${chatbotSlug}`);
      if (this.userId != null && !isValidUUIDv4(this.userId)) {
        this.userId = null;
      }
    }
    if (this.userId) {
      console.log("USER ID", this.userId);
    }
  }

  async newChat(): Promise<void> {
    await this.ensureWebSocketConnection();

    this.websocket!.send(JSON.stringify({ type: "clientCreatedNewChat" }));
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
          this.websocket!.removeEventListener("message", messageHandler);
          resolve();
        }
      };
      this.websocket!.addEventListener("message", messageHandler);
    });
  }

  private async ensureWebSocketConnection(): Promise<void> {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      await this.setupWebSocket();
    }
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      throw new Error("Failed to establish WebSocket connection");
    }
  }

  async getChatConfig(): Promise<ChatbotData> {
    console.log("INIT CHAT");
    const params = {
      language: (navigator.language || "en-US").split("-")[0],
      hiddenChat: this.hiddenChat.toString(),
      restoreChat: this.restoreChat.toString(),
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

      let isInitialConnection = true;

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
        wsUrl.searchParams.append("restoreChat", this.restoreChat.toString());
        wsUrl.searchParams.append("logEnabled", this.logEnabled.toString());
        this.websocket = new WebSocket(wsUrl.toString());

        this.websocket.onopen = () => {
          console.log("WebSocket connection established");
          if (isInitialConnection) {
            isInitialConnection = false;
            resolve();
          }
        };

        this.websocket.onerror = async (error) => {
          console.error("WebSocket connection error:", error);
          this.websocket = null;
          retryConnection();
        };

        this.websocket.onclose = (event) => {
          console.log("WebSocket connection closed", event);
          this.websocket = null;
          retryConnection();
        };
      };

      const retryConnection = () => {
        const delay = 1000; // 1 second delay between reconnection attempts
        console.log(`Attempting to reconnect in ${delay}ms...`);
        setTimeout(connect, delay);
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
    await this.ensureWebSocketConnection();
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
        if (
          chunk.type === "functionCallBegin" &&
          chunk.functionName === "fetch_room_availability" &&
          this.onCheckingAvailability
        ) {
          await this.onCheckingAvailability();
        } else if (
          chunk.type === "functionCallEnd" &&
          chunk.functionName === "fetch_room_availability" &&
          this.onDoneCheckingAvailability
        ) {
          await this.onDoneCheckingAvailability();
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
