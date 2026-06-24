import React, { useEffect, useRef, useState } from "react";
import { MoreVertical, PencilLine, Trash2, X } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { formatMessageTime } from "../lib/utils";

type MessageBubbleProps = {
  message: any;
  selectedUser: any;
};

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, selectedUser }) => {
  const { authUser } = useAuthStore();
  const { startEditingMessage, deleteMessage } = useChatStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isMyMessage = String(message.senderId) === String(authUser?._id || "");
  const deletedByMe = String(message.deletedBy || "") === String(authUser?._id || "");
  const canShowActions = isMyMessage && !message.isDeleted;

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    setIsMenuOpen(false);
    await deleteMessage(message._id);
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!isMenuOpen) return;

      const target = event.target as Node | null;
      if (target && menuRef.current && !menuRef.current.contains(target)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isMenuOpen]);

  return (
    <>
      <div className="chat-image avatar">
        <div className="size-10 rounded-full border">
          <img
            src={
              isMyMessage
                ? authUser?.profilePic || "/avatar.png"
                : selectedUser?.profilePic || "/avatar.png"
            }
            alt="profile pic"
          />
        </div>
      </div>

      <div className="chat-bubble flex flex-col relative group">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {message.isDeleted ? (
              <div className="rounded-lg border border-dashed border-base-300 bg-base-200/60 px-3 py-2 text-sm text-base-content/70">
                <p className="italic">{deletedByMe ? "You deleted this message" : "This message was deleted"}</p>
                <p className="mt-1 text-[11px] opacity-70">
                  {message.deletedAt ? `Deleted ${formatMessageTime(message.deletedAt)}` : "Deleted message"}
                </p>
              </div>
            ) : (
              <>
                {message.image && (
                  <img src={message.image} alt="Attachment" className="sm:max-w-[200px] rounded-md mb-2" />
                )}
                {message.text && <p>{message.text}</p>}
                {message.editedAt && <span className="mt-1 text-[11px] text-gray-400 italic self-end">edited</span>}
              </>
            )}
          </div>

          {canShowActions && (
            <div ref={menuRef} className={`dropdown dropdown-end shrink-0 ${isMenuOpen ? "dropdown-open" : ""}`}>
              <button
                type="button"
                className={`btn btn-ghost btn-xs btn-circle transition-opacity ${isMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"}`}
                onClick={() => setIsMenuOpen((current) => !current)}
                aria-label="Message actions"
              >
                <MoreVertical className="size-4" />
              </button>

              {isMenuOpen && (
                <ul
                  tabIndex={0}
                  className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-36 mt-2 border border-base-300"
                >
                  <li>
                    <button
                      type="button"
                      className="flex items-center gap-2"
                      onClick={() => {
                        setIsMenuOpen(false);
                        startEditingMessage(message);
                      }}
                    >
                      <PencilLine className="size-4" />
                      Edit
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="flex items-center gap-2 text-error"
                      onClick={() => {
                        setIsMenuOpen(false);
                        setShowDeleteConfirm(true);
                      }}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </button>
                  </li>
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="mt-2 self-end text-xs text-gray-400 flex items-center gap-1">
          <time className="opacity-60">{formatMessageTime(message.createdAt)}</time>
          {isMyMessage && !message.isDeleted && (
            <span className="ml-1 flex items-center" title={message.status}>
              {message.status === "seen" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-blue-500">
                  <path d="M1 12.5L6 17.5L10.5 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9 12.5L14 17.5L23 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : message.status === "delivered" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-500">
                  <path d="M1 12.5L6 17.5L10.5 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9 12.5L14 17.5L23 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-500">
                  <path d="M2 12L7 17L22 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
          )}
        </div>

        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-sm rounded-2xl border border-base-300 bg-base-100 p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Delete message?</h3>
                  <p className="mt-1 text-sm text-base-content/70">This will delete the message for everyone in the chat.</p>
                </div>
                <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowDeleteConfirm(false)}>
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-4 rounded-xl bg-base-200 p-3 text-sm text-base-content/80 max-h-32 overflow-hidden">
                {message.text ? <p>{message.text}</p> : <p className="italic">No text preview available.</p>}
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button type="button" className="btn btn-ghost" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-error text-white" onClick={handleDelete}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default MessageBubble;