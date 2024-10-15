import { z } from "zod";

export interface ChatMessage {
  content: string;
  role: "assistant" | "user" | "error";
  widgetId?: string;
}

export const ChatbotDataSchema = z.object({
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
      widgetId: z.string().optional(),
    })
  ),
  suggestedQuestions: z.record(z.string(), z.array(z.string())),
});

export type ChatbotData = z.infer<typeof ChatbotDataSchema>;

export interface ChatbotState {
  isChatOpen: boolean;
  isMaximized: boolean;
  introShown: boolean;
  hasBeenOpened: boolean;
  userId: string;
  chatbotSlug: string;
}
