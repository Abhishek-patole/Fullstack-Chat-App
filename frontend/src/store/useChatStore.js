import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  unreadCounts: {},
  newMessageListener: null,

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");

      const unreadCounts = {};
      const users = res.data.map((user) => {
        unreadCounts[user._id] = user.unreadCount || 0;
        return user;
      });
      set({ users, unreadCounts });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },
  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        messageData,
      );
      set({ messages: [...messages, res.data] });
    } catch (error) {
      toast.error(error.response.data.message);
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

  const listener = (newMessage) => {
    const { selectedUser, messages } = get();

    const isFromMe = newMessage.senderId === authUser._id;
    if (isFromMe) return;

    const isFromOpenedChat = selectedUser?._id === newMessage.senderId;

    if (isFromOpenedChat) {
      set({ messages: [...messages, newMessage] });
      get().clearUnreadCount(newMessage.senderId);
    } else {
      get().incrementUnreadCount(newMessage.senderId);
    }
  };

  socket.on("newMessage", listener);
  set({ newMessageListener: listener });
},

unsubscribeFromMessages: () => {
  const socket = useAuthStore.getState().socket;
  const listener = get().newMessageListener;

  if (socket && listener) {
    socket.off("newMessage", listener);
  }

  set({ newMessageListener: null });
},

  setSelectedUser: (selectedUser) => {
  set({ selectedUser });

  if (selectedUser?._id) {
    get().clearUnreadCount(selectedUser._id);
  }
},
}));
