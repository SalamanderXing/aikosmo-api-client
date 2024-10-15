"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  ChatbotApi: () => ChatbotApi
});
module.exports = __toCommonJS(src_exports);
var import_ky = __toESM(require("ky"));

// src/types.ts
var import_zod = require("zod");
var DbChatbotDataSchema = import_zod.z.object({
  popupMessageTitle: import_zod.z.record(import_zod.z.string(), import_zod.z.string()),
  popupMessage: import_zod.z.record(import_zod.z.string(), import_zod.z.string()),
  avatarUrl: import_zod.z.string(),
  logoUrl: import_zod.z.string(),
  primaryColor: import_zod.z.string(),
  secondaryColor: import_zod.z.string(),
  borderRadius: import_zod.z.number().nullable(),
  borderColorChat: import_zod.z.string().nullable(),
  borderColorAvatar: import_zod.z.string().nullable(),
  rightDesktop: import_zod.z.number(),
  avatarUrl2: import_zod.z.string().nullable().optional(),
  bottomDesktop: import_zod.z.number(),
  bottomMobile: import_zod.z.number(),
  linearTransitionColor: import_zod.z.string().nullable(),
  logoMaxWidthPercentage: import_zod.z.number().nullable(),
  chatAvatarUrl: import_zod.z.string().nullable(),
  exitPopupEnabled: import_zod.z.boolean(),
  bookingIframeEnabled: import_zod.z.boolean()
});
var ChatbotDataSchema = DbChatbotDataSchema.extend({
  slug: import_zod.z.string(),
  userId: import_zod.z.string(),
  introMessage: import_zod.z.record(import_zod.z.string(), import_zod.z.string()),
  history: import_zod.z.array(
    import_zod.z.object({
      content: import_zod.z.string(),
      role: import_zod.z.enum(["assistant", "user", "error"]),
      widgetId: import_zod.z.string().optional()
    })
  ),
  suggestedQuestions: import_zod.z.record(import_zod.z.string(), import_zod.z.array(import_zod.z.string()))
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
var ChatbotApi = class {
  constructor(sourceUrl, chatbotSlug, hiddenChat, restoreChat = true) {
    this.sourceUrl = sourceUrl;
    this.chatbotSlug = chatbotSlug;
    this.hiddenChat = hiddenChat;
    this.restoreChat = restoreChat;
    this.userId = null;
    this.websocket = null;
    this.onChecking = null;
    this.onDoneChecking = null;
    this.onError = null;
    assert(typeof hiddenChat === "boolean", "Invalid hidden chat");
    assert(typeof chatbotSlug === "string", "Invalid chatbot slug");
    assert(typeof sourceUrl === "string", "Invalid source URL");
    assert(typeof restoreChat === "boolean", "Invalid restore chat");
    this.userId = localStorage.getItem(`userId-${chatbotSlug}`);
    if (this.userId != null && !isValidUUIDv4(this.userId)) {
      this.userId = null;
    } else {
      console.log("USER ID", this.userId);
    }
  }
  async newChat() {
    if (this.websocket === null) {
      await this.setupWebSocket();
    }
    if (!this.websocket) {
      throw new Error("WebSocket connection not established");
    }
    this.websocket?.send(JSON.stringify({ type: "clientCreatedNewChat" }));
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
          this.websocket?.removeEventListener("message", messageHandler);
          resolve();
        }
      };
      this.websocket?.addEventListener("message", messageHandler);
    });
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
    const responseJson = await import_ky.default.get(`${this.sourceUrl}/api/get_config`, {
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ChatbotApi
});
