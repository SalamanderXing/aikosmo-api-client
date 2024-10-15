// src/index.ts
import ky from "ky";

// src/types.ts
import { z } from "zod";
var ChatbotDataSchema = z.object({
  popupMessageTitle: z.record(z.string(), z.string()),
  popupMessage: z.record(z.string(), z.string()),
  avatarUrl: z.string(),
  logoUrl: z.string(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  borderRadius: z.number().nullable(),
  borderColorChat: z.string().nullable(),
  borderColorAvatar: z.string().nullable(),
  rightDesktop: z.number(),
  avatarUrl2: z.string().nullable().optional(),
  bottomDesktop: z.number(),
  bottomMobile: z.number(),
  linearTransitionColor: z.string().nullable(),
  logoMaxWidthPercentage: z.number().nullable(),
  chatAvatarUrl: z.string().nullable(),
  exitPopupEnabled: z.boolean(),
  bookingIframeEnabled: z.boolean(),
  slug: z.string(),
  userId: z.string(),
  introMessage: z.record(z.string(), z.string()),
  history: z.array(
    z.object({
      content: z.string(),
      role: z.enum(["assistant", "user", "error"]),
      widgetId: z.string().optional()
    })
  ),
  suggestedQuestions: z.record(z.string(), z.array(z.string()))
});

// src/index.ts
function isValidUUIDv4(str) {
  const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidv4Regex.test(str);
}
var assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};
var isValidHttpsUrl = (url) => {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
};
var ChatbotApi = class {
  constructor({
    sourceUrl,
    chatbotSlug,
    hiddenChat,
    restoreChat = true,
    userId = null
  }) {
    this.websocket = null;
    this.onChecking = null;
    this.onDoneChecking = null;
    this.onError = null;
    assert(isValidHttpsUrl(sourceUrl), "Invalid source URL");
    assert(typeof hiddenChat === "boolean", "Invalid hidden chat");
    assert(typeof chatbotSlug === "string", "Invalid chatbot slug");
    assert(typeof restoreChat === "boolean", "Invalid restore chat");
    this.sourceUrl = sourceUrl;
    this.chatbotSlug = chatbotSlug;
    this.hiddenChat = hiddenChat;
    this.restoreChat = restoreChat;
    this.userId = userId;
    if (typeof window !== "undefined" && window.localStorage) {
      this.userId = this.userId ?? localStorage.getItem(`userId-${chatbotSlug}`);
      if (this.userId != null && !isValidUUIDv4(this.userId)) {
        this.userId = null;
      }
    }
    if (this.userId) {
      console.log("USER ID", this.userId);
    }
  }
  async newChat() {
    await this.ensureWebSocketConnection();
    this.websocket.send(JSON.stringify({ type: "clientCreatedNewChat" }));
    return new Promise((resolve, reject) => {
      const timeoutDuration = 1e4;
      const timeoutId = setTimeout(() => {
        reject(
          new Error("Timeout: Server did not respond with newChatCreated")
        );
      }, timeoutDuration);
      const messageHandler = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "newChatCreated") {
          clearTimeout(timeoutId);
          this.websocket.removeEventListener("message", messageHandler);
          resolve();
        }
      };
      this.websocket.addEventListener("message", messageHandler);
    });
  }
  async ensureWebSocketConnection() {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      await this.setupWebSocket();
    }
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      throw new Error("Failed to establish WebSocket connection");
    }
  }
  async getChatConfig() {
    console.log("INIT CHAT");
    const params = {
      language: (navigator.language || "en-US").split("-")[0],
      hiddenChat: this.hiddenChat.toString(),
      restoreChat: this.restoreChat.toString()
    };
    if (this.chatbotSlug) {
      params.chatbotSlug = this.chatbotSlug;
    }
    if (this.userId) {
      params.userId = this.userId;
    }
    const responseJson = await ky.get(`${this.sourceUrl}/api/get_config`, {
      searchParams: params
    }).json();
    console.log(responseJson);
    if (this.userId !== responseJson.userId) {
      console.log("UPDATING user ID", responseJson.userId);
      this.userId = responseJson.userId;
      localStorage.setItem(`userId-${this.chatbotSlug}`, responseJson.userId);
    }
    console.log("HISTORY");
    console.log(responseJson.history);
    if (responseJson.history.length > 0) {
      const introMessageObj = {
        role: "assistant",
        content: responseJson.introMessage[params.language]
      };
      responseJson.history.unshift(introMessageObj);
    }
    console.log("Response JSON keys:", Object.keys(responseJson));
    console.log(responseJson.popupMessageTitle);
    console.log(responseJson.popupMessage);
    console.log(responseJson.suggestedQuestions);
    return ChatbotDataSchema.parse(responseJson);
  }
  async setupWebSocket() {
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
        const delay = 1e3;
        console.log(`Attempting to reconnect in ${delay}ms...`);
        setTimeout(connect, delay);
      };
      connect();
    });
  }
  async fetchChatResponse({
    newMessage,
    onNewChunk,
    onDone
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
    return new Promise((resolve, reject) => {
      if (!this.websocket) {
        reject(new Error("WebSocket connection not established"));
        return;
      }
      let hasReceivedResponse = false;
      const timeoutDuration = 12e4;
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
        const chunk = JSON.parse(event.data);
        console.log("CHUNK", chunk);
        if (chunk.type === "functionCallBegin" && chunk.functionName === "fetch_room_availability" && this.onChecking) {
          await this.onChecking();
        } else if (chunk.type === "functionCallEnd" && chunk.functionName === "fetch_room_availability" && this.onDoneChecking) {
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
};
export {
  ChatbotApi,
  ChatbotDataSchema
};
