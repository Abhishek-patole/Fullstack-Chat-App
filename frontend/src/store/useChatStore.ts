import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

type Message = { [k: string]: any };
type UserItem = { _id: string; unreadCount?: number; [k: string]: any };

const normalizeMessage = (message: any) => ({
  ...message,
  _id: String(message._id),
  senderId: typeof message.senderId === "object" ? String(message.senderId?._id ?? message.senderId) : String(message.senderId),
  receiverId: typeof message.receiverId === "object" ? String(message.receiverId?._id ?? message.receiverId) : String(message.receiverId),
});

type ChatState = {
  messages: Message[];
  users: UserItem[];
  selectedUser: UserItem | null;
  isUsersLoading: boolean;
  isMessagesLoading: boolean;
  unreadCounts: Record<string, number>;
  newMessageListener: ((msg: any) => void) | null;
  messageStatusListener: ((payload: any) => void) | null;

  getUsers: () => Promise<void>;
  getMessages: (userId: string) => Promise<void>;
  sendMessage: (messageData: any) => Promise<void>;
  incrementUnreadCount: (senderId: string) => void;
  clearUnreadCount: (userId: string) => void;
  subscribeToMessages: () => void;
  unsubscribeFromMessages: () => void;
  setSelectedUser: (user: UserItem | null) => void;
};

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  unreadCounts: {},
  newMessageListener: null,
  messageStatusListener: null,

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");

      const unreadCounts: Record<string, number> = {};
      const users: UserItem[] = res.data.map((user: any) => {
        unreadCounts[user._id] = user.unreadCount || 0;
        return user;
      });
      set({ users, unreadCounts });
    } catch (error) {
      toast.error((error as any)?.response?.data?.message || String(error));
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data.map(normalizeMessage) });
    } catch (error) {
      toast.error((error as any)?.response?.data?.message || String(error));
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser?._id}`, messageData);
      set({ messages: [...messages, normalizeMessage(res.data)] });
    } catch (error) {
      toast.error((error as any)?.response?.data?.message || String(error));
    }
  },

  incrementUnreadCount: (senderId) => {
    const { selectedUser, unreadCounts } = get();

    if (selectedUser?._id === senderId) return;

    set({
      unreadCounts: {
        ...unreadCounts,
        [senderId]: (unreadCounts[senderId] || 0) + 1,
      },
    });
  },

  clearUnreadCount: (userId) => {
    const { unreadCounts } = get();

    set({
      unreadCounts: {
        ...unreadCounts,
        [userId]: 0,
      },
    });
  },

  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    const authUser = useAuthStore.getState().authUser;

    if (!socket || !authUser) return;

    const currentListener = get().newMessageListener;
    if (currentListener) {
      socket.off("newMessage", currentListener);
    }

    const currentStatusListener = get().messageStatusListener;
    if (currentStatusListener) {
      socket.off("messageStatusUpdated", currentStatusListener);
    }

    const listener = (newMessage: any) => {
      const { selectedUser, messages } = get();
      const socket = useAuthStore.getState().socket;
      const normalizedMessage = normalizeMessage(newMessage);

      const isFromMe = normalizedMessage.senderId === String(authUser._id);
      if (isFromMe) return;

      const isFromOpenedChat = selectedUser?._id === normalizedMessage.senderId;

      if (isFromOpenedChat) {
        set({ messages: [...messages, normalizedMessage] });
        get().clearUnreadCount(normalizedMessage.senderId);

        // This message is visible in the open chat, so mark it as seen immediately.
        socket?.emit("messageSeen", { messageId: normalizedMessage._id });
      } else {
        get().incrementUnreadCount(normalizedMessage.senderId);
      }
    };

    socket.on("newMessage", listener);
    set({ newMessageListener: listener });

    // attach message status update listener
    const statusListener = (payload: any) => {
      const { messageId, status, deliveredAt, readAt, receiverId } = payload;
      const { messages, unreadCounts, selectedUser } = get();
      const normalizedMessageId = String(messageId);

      // update messages in the current chat if present
      const updatedMessages = messages.map((m: any) => {
        if (String(m._id) === normalizedMessageId) {
          return {
            ...m,
            status: status || m.status,
            deliveredAt: deliveredAt || m.deliveredAt,
            readAt: readAt || m.readAt,
          };
        }
        return m;
      });

      set({ messages: updatedMessages });

      // if the message was seen by the receiver and that receiver is the currently selected user, clear unread
      if (status === "seen") {
        const senderId = String(selectedUser?._id) === String(receiverId) ? String(useAuthStore.getState().authUser?._id) : String(receiverId);
        // If the seen message belongs to the selectedUser chat, clear its unread count
        if (selectedUser && String(selectedUser._id) === String(receiverId)) {
          get().clearUnreadCount(String(receiverId));
        } else if (senderId) {
          // otherwise ensure unreadCounts for that sender is zero
          set({
            unreadCounts: {
              ...unreadCounts,
              [senderId]: 0,
            },
          });
        }
      }
    };

    socket.on("messageStatusUpdated", statusListener);
    set({ messageStatusListener: statusListener });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    const listener = get().newMessageListener;
    const statusListener = get().messageStatusListener;

    if (socket && listener) {
      socket.off("newMessage", listener);
    }
    if (socket && statusListener) {
      socket.off("messageStatusUpdated", statusListener);
    }

    set({ newMessageListener: null });
    set({ messageStatusListener: null });
  },

  setSelectedUser: (selectedUser) => {
    set({ selectedUser });

    if (selectedUser?._id) {
      get().clearUnreadCount(selectedUser._id);
    }
  },
}));
