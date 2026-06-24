import React, { useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { Check, Image, Send, X } from "lucide-react";
import toast from "react-hot-toast";
import { MessageFormSchema } from "../lib/validation";
import { ZodError } from "zod";

const MessageInput: React.FC = () => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const composeDraftRef = useRef<{ text: string; imagePreview: string | null }>({
    text: "",
    imagePreview: null,
  });
  const {
    sendMessage,
    editMessage,
    editingMessage,
    cancelEditingMessage,
  } = useChatStore();

  const restoreComposeDraft = () => {
    const draft = composeDraftRef.current;

    setText(draft.text);
    setImagePreview(draft.imagePreview);
    composeDraftRef.current = { text: "", imagePreview: null };

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCancelEdit = () => {
    cancelEditingMessage();
    restoreComposeDraft();
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (editingMessage) {
      composeDraftRef.current = { text, imagePreview };
      setText(editingMessage.text || "");
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      inputRef.current?.focus();
    }
  }, [editingMessage]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && editingMessage) {
        handleCancelEdit();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [editingMessage]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMessage) {
        const trimmedText = text.trim();
        if (!trimmedText) {
          toast.error("Message text is required");
          return;
        }

        await editMessage(editingMessage._id, trimmedText);
        handleCancelEdit();
      } else {
        MessageFormSchema.parse({ text, imagePreview });
        await sendMessage({ text: text.trim(), image: imagePreview });

        setText("");
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldError = error.issues[0];
        toast.error(fieldError.message);
      } else {
        console.error("Failed to send message:", error);
      }
    }
  };

  return (
    <div className="p-4 w-full">
      {editingMessage && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-base-300 bg-base-200 px-3 py-2">
          <div>
            <p className="text-sm font-medium">Editing message</p>
            <p className="text-xs text-base-content/70">Press Esc or Cancel to keep your draft and stop editing.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleCancelEdit}>
            Cancel
          </button>
        </div>
      )}

      {imagePreview && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative">
            <img src={imagePreview} alt="Preview" className="w-20 h-20 object-cover rounded-lg border border-zinc-700" />
            <button
              onClick={removeImage}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300 flex items-center justify-center"
              type="button"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <div className="flex-1 flex gap-2">
          <input
            ref={inputRef}
            type="text"
            className="w-full input input-bordered rounded-lg input-sm sm:input-md"
            placeholder={editingMessage ? "Edit your message..." : "Type a message..."}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {!editingMessage && (
            <>
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />

              <button type="button" className={`hidden sm:flex btn btn-circle ${imagePreview ? "text-emerald-500" : "text-zinc-400"}`} onClick={() => fileInputRef.current?.click()}>
                <Image size={20} />
              </button>
            </>
          )}
        </div>
        <button
          type="submit"
          className="btn btn-sm btn-circle"
          disabled={editingMessage ? !text.trim() : (!text.trim() && !imagePreview)}
        >
          {editingMessage ? <Check size={22} /> : <Send size={22} />}
        </button>
      </form>
    </div>
  );
};

export default MessageInput;
