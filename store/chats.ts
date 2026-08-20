import { create } from 'zustand';

export type Message = {
  id: number;
  sender: 'you' | 'other';
  text: string;
  time: string;
};

export type Conversation = {
  id: number;
  dropId: number;
  dropText: string;
  participantName: string;
  participantUsername: string;
  messages: Message[];
};

type ChatStore = {
  conversations: Conversation[];

  createConversation: (conversation: Conversation) => void;

  sendMessage: (
    conversationId: number,
    text: string
  ) => void;
};

export const useChatStore = create<ChatStore>((set) => ({
  conversations: [],

  createConversation: (conversation) =>
    set((state) => {
      const alreadyExists = state.conversations.some(
        (item) =>
          item.dropId === conversation.dropId &&
          item.participantUsername ===
            conversation.participantUsername
      );

      if (alreadyExists) {
        return state;
      }

      return {
        conversations: [
          conversation,
          ...state.conversations,
        ],
      };
    }),

  sendMessage: (conversationId, text) =>
    set((state) => ({
      conversations: state.conversations.map(
        (conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                messages: [
                  ...conversation.messages,
                  {
                    id: Date.now(),
                    sender: 'you',
                    text,
                    time: 'now',
                  },
                ],
              }
            : conversation
      ),
    })),
}));