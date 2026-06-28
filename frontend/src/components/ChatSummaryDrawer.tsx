import React, { useEffect, useRef } from "react";
import { useChatStore } from "../store/useChatStore";
import { X, Copy, RefreshCw, Sparkles } from "lucide-react";
import toast from "react-hot-toast";

const ChatSummaryDrawer: React.FC = () => {
  const {
    isSummaryDrawerOpen,
    setSummaryDrawerOpen,
    chatSummary,
    isSummaryLoading,
    fetchChatSummary,
    selectedUser,
  } = useChatStore();

  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSummaryDrawerOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [setSummaryDrawerOpen]);

  if (!isSummaryDrawerOpen) return null;

  const handleCopy = () => {
    if (chatSummary) {
      navigator.clipboard.writeText(chatSummary);
      toast.success("Summary copied to clipboard!");
    }
  };

  const handleRefresh = () => {
    if (selectedUser) {
      fetchChatSummary(selectedUser._id);
    }
  };

  // Basic formatting for the AI structured response
  const formatSummary = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      // Headers wrapped in **
      if (line.startsWith("**") && line.includes("**", 2)) {
        const clean = line.replace(/\*\*/g, "");
        return (
          <h4 key={idx} className="font-semibold text-sm mt-4 mb-2 text-primary">
            {clean}
          </h4>
        );
      }
      // Bullet points
      if (line.trim().startsWith("* ") || line.trim().startsWith("- ")) {
        return (
          <li key={idx} className="ml-4 mb-1 list-disc text-sm">
            {line.substring(2)}
          </li>
        );
      }
      if (line.trim() === "") return null;
      // Normal paragraphs
      return (
        <p key={idx} className="mb-2 text-sm">
          {line}
        </p>
      );
    });
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className="md:hidden fixed inset-0 bg-black/40 z-40"
        onClick={() => setSummaryDrawerOpen(false)}
      />

      {/* Drawer / Bottom Sheet Container */}
      <div
        ref={sheetRef}
        className="fixed md:static inset-x-0 bottom-0 md:inset-auto z-50 md:z-auto 
                   w-full md:w-80 lg:w-96 h-[85vh] md:h-full 
                   bg-base-100 border-t md:border-t-0 md:border-l border-base-300
                   rounded-t-3xl md:rounded-none shadow-2xl md:shadow-none
                   flex flex-col transition-transform"
      >
        {/* Mobile Swipe Handle */}
        <div
          className="md:hidden w-full flex justify-center pt-3 pb-1 cursor-pointer"
          onClick={() => setSummaryDrawerOpen(false)}
        >
          <div className="w-12 h-1.5 bg-base-300 rounded-full"></div>
        </div>

        {/* Header */}
        <div className="p-4 border-b border-base-300 flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <Sparkles className="w-5 h-5 text-primary" />
            Chat Summary
          </div>
          <button
            onClick={() => setSummaryDrawerOpen(false)}
            className="btn btn-sm btn-circle btn-ghost"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isSummaryLoading ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <div className="h-4 w-32 bg-base-300 rounded animate-pulse mb-2"></div>
                <div className="h-3 w-full bg-base-300 rounded animate-pulse"></div>
                <div className="h-3 w-5/6 bg-base-300 rounded animate-pulse"></div>
              </div>
              <div className="flex flex-col gap-2 mt-6">
                <div className="h-4 w-40 bg-base-300 rounded animate-pulse mb-2"></div>
                <div className="h-3 w-full bg-base-300 rounded animate-pulse"></div>
                <div className="h-3 w-4/5 bg-base-300 rounded animate-pulse"></div>
                <div className="h-3 w-full bg-base-300 rounded animate-pulse"></div>
              </div>
              <div className="flex flex-col gap-2 mt-6">
                <div className="h-4 w-36 bg-base-300 rounded animate-pulse mb-2"></div>
                <div className="h-3 w-3/4 bg-base-300 rounded animate-pulse"></div>
              </div>
            </div>
          ) : chatSummary ? (
            <div className="text-base-content/80">{formatSummary(chatSummary)}</div>
          ) : null}
        </div>

        {/* Footer Actions */}
        {!isSummaryLoading && chatSummary && (
          <div className="p-4 border-t border-base-300 flex gap-2">
            <button className="btn btn-outline btn-sm flex-1 gap-2" onClick={handleCopy}>
              <Copy className="w-4 h-4" />
              Copy
            </button>
            <button className="btn btn-outline btn-sm flex-1 gap-2" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default ChatSummaryDrawer;
