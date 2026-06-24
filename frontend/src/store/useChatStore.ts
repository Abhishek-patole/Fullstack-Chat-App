import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

type Message = {
  _id: string;
  senderId: string;
  receiverId: string;
  text?: string;
  image?: string;
  status?: "sent" | "delivered" | "seen";
  deliveredAt?: string | null;
  isRead?: boolean;
  readAt?: string | null;
  editedAt?: string | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [k: string]: any;
};
type UserItem = { _id: string; unreadCount?: number; [k: string]: any };

const normalizeMessage = (message: any) => ({
  ...message,
  _id: String(message._id),
  senderId: typeof message.senderId === "object" ? String(message.senderId?._id ?? message.senderId) : String(message.senderId),
  receiverId: typeof message.receiverId === "object" ? String(message.receiverId?._id ?? message.receiverId) : String(message.receiverId),
  isDeleted: Boolean(message.isDeleted),
  deletedBy: message.deletedBy ? String(message.deletedBy?._id ?? message.deletedBy) : null,
  editedAt: message.editedAt || null,
  deletedAt: message.deletedAt || null,
  deliveredAt: message.deliveredAt || null,
  readAt: message.readAt || null,
  createdAt: message.createdAt || undefined,
  updatedAt: message.updatedAt || undefined,
});

const upsertMessage = (messages: Message[], message: Message) => {
  const existingIndex = messages.findIndex((item) => String(item._id) === String(message._id));

  if (existingIndex === -1) {
    return [...messages, message];
  }

  return messages.map((item) => (String(item._id) === String(message._id) ? { ...item, ...message } : item));
};

const removeMessageById = (messages: Message[], messageId: string) => {
  return messages.map((item) => {
    if (String(item._id) !== String(messageId)) return item;

    return {
      ...item,
      isDeleted: true,
      deletedAt: item.deletedAt || new Date().toISOString(),
      deletedBy: item.deletedBy || item.senderId,
      text: "",
      image: undefined,
      editedAt: null,
    };
  });
};

type ChatState = {
  messages: Message[];
  users: UserItem[];
  selectedUser: UserItem | null;
  editingMessage: Message | null;
  isUsersLoading: boolean;
  isMessagesLoading: boolean;
  unreadCounts: Record<string, number>;
  newMessageListener: ((msg: any) => void) | null;
  messageStatusListener: ((payload: any) => void) | null;
  messageUpdatedListener: ((payload: any) => void) | null;
  messageDeletedListener: ((payload: any) => void) | null;

  getUsers: () => Promise<void>;
  getMessages: (userId: string) => Promise<void>;
  sendMessage: (messageData: any) => Promise<void>;
  editMessage: (messageId: string, text: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  startEditingMessage: (message: Message) => void;
  cancelEditingMessage: () => void;
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
  editingMessage: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  unreadCounts: {},
  newMessageListener: null,
  messageStatusListener: null,
  messageUpdatedListener: null,
  messageDeletedListener: null,

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

  editMessage: async (messageId, text) => {
    try {
      const res = await axiosInstance.patch(`/messages/${messageId}`, { text });
      const updatedMessage = normalizeMessage(res.data);

      set({
        messages: upsertMessage(get().messages, updatedMessage),
        editingMessage: get().editingMessage?._id === messageId ? null : get().editingMessage,
      });
    } catch (error) {
      toast.error((error as any)?.response?.data?.message || String(error));
    }
  },

  deleteMessage: async (messageId) => {
    try {
      const res = await axiosInstance.delete(`/messages/${messageId}`);
      const deletedMessage = normalizeMessage(res.data);

      set({
        messages: upsertMessage(get().messages, deletedMessage),
        editingMessage: get().editingMessage?._id === messageId ? null : get().editingMessage,
      });
    } catch (error) {
      toast.error((error as any)?.response?.data?.message || String(error));
    }
  },

  startEditingMessage: (message) => {
    set({ editingMessage: message });
  },

  cancelEditingMessage: () => {
    set({ editingMessage: null });
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

    const currentUpdatedListener = get().messageUpdatedListener;
    if (currentUpdatedListener) {
      socket.off("messageUpdated", currentUpdatedListener);
    }

    const currentDeletedListener = get().messageDeletedListener;
    if (currentDeletedListener) {
      socket.off("messageDeleted", currentDeletedListener);
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

    const updatedListener = (payload: any) => {
      const normalizedMessage = normalizeMessage(payload);
      set({
        messages: upsertMessage(get().messages, normalizedMessage),
      });
    };

    socket.on("messageUpdated", updatedListener);
    set({ messageUpdatedListener: updatedListener });

    const deletedListener = (payload: any) => {
      const { messageId, deletedAt, deletedBy } = payload;
      set({
        messages: removeMessageById(get().messages, String(messageId)).map((item) =>
          String(item._id) === String(messageId)
            ? {
                ...item,
                deletedAt: deletedAt || item.deletedAt,
                deletedBy: deletedBy ? String(deletedBy?._id ?? deletedBy) : item.deletedBy,
              }
            : item
        ),
        editingMessage: get().editingMessage?._id === String(messageId) ? null : get().editingMessage,
      });
    };

    socket.on("messageDeleted", deletedListener);
    set({ messageDeletedListener: deletedListener });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    const listener = get().newMessageListener;
    const statusListener = get().messageStatusListener;
    const updatedListener = get().messageUpdatedListener;
    const deletedListener = get().messageDeletedListener;

    if (socket && listener) {
      socket.off("newMessage", listener);
    }
    if (socket && statusListener) {
      socket.off("messageStatusUpdated", statusListener);
    }
    if (socket && updatedListener) {
      socket.off("messageUpdated", updatedListener);
    }
    if (socket && deletedListener) {
      socket.off("messageDeleted", deletedListener);
    }

    set({ newMessageListener: null });
    set({ messageStatusListener: null });
    set({ messageUpdatedListener: null });
    set({ messageDeletedListener: null });
  },

  setSelectedUser: (selectedUser) => {
    set({ selectedUser, editingMessage: null });

    if (selectedUser?._id) {
      get().clearUnreadCount(selectedUser._id);
    }
  },
}));
