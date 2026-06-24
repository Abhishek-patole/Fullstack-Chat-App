import React, { useEffect, useRef } from "react";
import { useChatStore } from "../store/useChatStore";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import MessageBubble from "./MessageBubble";
import { useAuthStore } from "../store/useAuthStore";

const ChatContainer: React.FC = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    clearUnreadCount,
  } = useChatStore();

  const { authUser } = useAuthStore();
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selectedUser?._id) return;
    let mounted = true;

    const load = async () => {
      await getMessages(selectedUser._id);
      if (mounted) {
        clearUnreadCount(selectedUser._id);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [selectedUser?._id, getMessages, clearUnreadCount]);

  useEffect(() => {
    if (messageEndRef.current && messages) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message: any) => (
          <div
            key={message._id}
            className={`chat ${String(message.senderId) === String(authUser?._id || "") ? "chat-end" : "chat-start"}`}
            ref={messageEndRef as any}
          >
            <MessageBubble message={message} selectedUser={selectedUser} />
          </div>
        ))}
      </div>

      <MessageInput />
    </div>
  );
};

export default ChatContainer;
