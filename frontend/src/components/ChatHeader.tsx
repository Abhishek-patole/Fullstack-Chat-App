import React from "react";
import { X, Sparkles } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const ChatHeader: React.FC = () => {
  const { 
    selectedUser, 
    setSelectedUser,
    isSummaryDrawerOpen,
    setSummaryDrawerOpen,
    fetchChatSummary
  } = useChatStore();
  const { onlineUsers } = useAuthStore();

  if (!selectedUser) return null;

  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="avatar">
            <div className="size-10 rounded-full relative">
              <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
            </div>
          </div>

          <div>
            <h3 className="font-medium">{selectedUser.fullName}</h3>
            <p className="text-sm text-base-content/70">{onlineUsers.includes(selectedUser._id) ? "Online" : "Offline"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              if (!isSummaryDrawerOpen) {
                setSummaryDrawerOpen(true);
                fetchChatSummary(selectedUser._id);
              } else {
                setSummaryDrawerOpen(false);
              }
            }}
            className="btn btn-sm btn-ghost gap-2 text-primary"
            title="Summarize Chat"
          >
            <Sparkles className="w-5 h-5" />
            <span className="hidden sm:inline">Summarize</span>
          </button>
          
          <button onClick={() => setSelectedUser(null)}>
            <X />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;
