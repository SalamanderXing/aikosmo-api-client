import { z } from 'zod';

interface ChatMessage {
    content: string;
    role: "assistant" | "user" | "error";
    widgetId?: string;
}
declare const ChatbotDataSchema: z.ZodObject<{
    popupMessageTitle: z.ZodRecord<z.ZodString, z.ZodString>;
    popupMessage: z.ZodRecord<z.ZodString, z.ZodString>;
    avatarUrl: z.ZodString;
    logoUrl: z.ZodString;
    primaryColor: z.ZodString;
    secondaryColor: z.ZodString;
    borderRadius: z.ZodNullable<z.ZodNumber>;
    borderColorChat: z.ZodNullable<z.ZodString>;
    borderColorAvatar: z.ZodNullable<z.ZodString>;
    rightDesktop: z.ZodNumber;
    avatarUrl2: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    bottomDesktop: z.ZodNumber;
    bottomMobile: z.ZodNumber;
    linearTransitionColor: z.ZodNullable<z.ZodString>;
    logoMaxWidthPercentage: z.ZodNullable<z.ZodNumber>;
    chatAvatarUrl: z.ZodNullable<z.ZodString>;
    exitPopupEnabled: z.ZodBoolean;
    bookingIframeEnabled: z.ZodBoolean;
    slug: z.ZodString;
    userId: z.ZodString;
    introMessage: z.ZodRecord<z.ZodString, z.ZodString>;
    history: z.ZodArray<z.ZodObject<{
        content: z.ZodString;
        role: z.ZodEnum<["assistant", "user", "error"]>;
        widgetId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        content: string;
        role: "assistant" | "user" | "error";
        widgetId?: string | undefined;
    }, {
        content: string;
        role: "assistant" | "user" | "error";
        widgetId?: string | undefined;
    }>, "many">;
    suggestedQuestions: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    userId: string;
    popupMessageTitle: Record<string, string>;
    popupMessage: Record<string, string>;
    avatarUrl: string;
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
    borderRadius: number | null;
    borderColorChat: string | null;
    borderColorAvatar: string | null;
    rightDesktop: number;
    bottomDesktop: number;
    bottomMobile: number;
    linearTransitionColor: string | null;
    logoMaxWidthPercentage: number | null;
    chatAvatarUrl: string | null;
    exitPopupEnabled: boolean;
    bookingIframeEnabled: boolean;
    slug: string;
    introMessage: Record<string, string>;
    history: {
        content: string;
        role: "assistant" | "user" | "error";
        widgetId?: string | undefined;
    }[];
    suggestedQuestions: Record<string, string[]>;
    avatarUrl2?: string | null | undefined;
}, {
    userId: string;
    popupMessageTitle: Record<string, string>;
    popupMessage: Record<string, string>;
    avatarUrl: string;
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
    borderRadius: number | null;
    borderColorChat: string | null;
    borderColorAvatar: string | null;
    rightDesktop: number;
    bottomDesktop: number;
    bottomMobile: number;
    linearTransitionColor: string | null;
    logoMaxWidthPercentage: number | null;
    chatAvatarUrl: string | null;
    exitPopupEnabled: boolean;
    bookingIframeEnabled: boolean;
    slug: string;
    introMessage: Record<string, string>;
    history: {
        content: string;
        role: "assistant" | "user" | "error";
        widgetId?: string | undefined;
    }[];
    suggestedQuestions: Record<string, string[]>;
    avatarUrl2?: string | null | undefined;
}>;
type ChatbotData = z.infer<typeof ChatbotDataSchema>;

declare class ChatbotApi {
    private websocket;
    onCheckingAvailability: (() => Promise<void>) | null;
    onDoneCheckingAvailability: (() => Promise<void>) | null;
    onError: (() => Promise<void>) | null;
    sourceUrl: string;
    chatbotSlug: string;
    hiddenChat: boolean;
    restoreChat: boolean;
    userId: string | null;
    logEnabled: boolean;
    constructor({ sourceUrl, chatbotSlug, hiddenChat, restoreChat, userId, onCheckingAvailability, onDoneCheckingAvailability, onError, logEnabled, }: {
        sourceUrl: string;
        chatbotSlug: string;
        hiddenChat: boolean;
        restoreChat?: boolean;
        userId?: string | null;
        onCheckingAvailability?: (() => Promise<void>) | null;
        onDoneCheckingAvailability?: (() => Promise<void>) | null;
        onError?: (() => Promise<void>) | null;
        logEnabled?: boolean;
    });
    newChat(): Promise<void>;
    private ensureWebSocketConnection;
    getChatConfig(): Promise<ChatbotData>;
    private setupWebSocket;
    fetchChatResponse({ newMessage, onNewChunk, onDone, }: {
        newMessage: string;
        onNewChunk: (chunk: string) => Promise<void>;
        onDone: () => Promise<void>;
    }): Promise<void>;
}

export { type ChatMessage, ChatbotApi, type ChatbotData, ChatbotDataSchema };
