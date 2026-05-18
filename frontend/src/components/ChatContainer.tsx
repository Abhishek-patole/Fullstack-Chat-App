import React, { useEffect, useRef } from "react";
import { useChatStore } from "../store/useChatStore";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";

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

  const authUserId = String(authUser?._id || "");

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
            className={`chat ${String(message.senderId) === authUserId ? "chat-end" : "chat-start"}`}
            ref={messageEndRef as any}
          >
            <div className=" chat-image avatar">
              <div className="size-10 rounded-full border">
                <img
                  src={
                    String(message.senderId) === authUserId
                      ? authUser?.profilePic || "/avatar.png"
                      : selectedUser?.profilePic || "/avatar.png"
                  }
                  alt="profile pic"
                />
              </div>
            </div>
            {/* time & status will be shown inside the bubble (WhatsApp-like) */}
            <div className="chat-bubble flex flex-col relative">
              {message.image && (
                <img src={message.image} alt="Attachment" className="sm:max-w-[200px] rounded-md mb-2" />
              )}
              {message.text && <p>{message.text}</p>}
              {/* footer: time + status ticks positioned like WhatsApp */}
              <div className="mt-2 self-end text-xs text-gray-400 flex items-center gap-1">
                <time className="opacity-60">{formatMessageTime(message.createdAt)}</time>
                {String(message.senderId) === authUserId && (
                  <span className="ml-1 flex items-center" title={message.status}>
                    {message.status === "seen" ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-blue-500">
                        <path d="M1 12.5L6 17.5L10.5 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M9 12.5L14 17.5L23 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : message.status === "delivered" ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-500">
                        <path d="M1 12.5L6 17.5L10.5 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M9 12.5L14 17.5L23 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-500">
                        <path d="M2 12L7 17L22 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <MessageInput />
    </div>
  );
};

export default ChatContainer;
