"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CopyButtonProps {
  text: string;
  label: string;
  className?: string;
}

//! EXAMPLE USAGE:
//! <CopyButton text={application.user_email} label="Email" />

export function CopyButton({ text, label, className = "" }: CopyButtonProps) {
  const [isCopied, setIsCopied] = useState(false);

  const fallbackCopy = (text: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        
        textArea.style.position = "fixed";
        textArea.style.top = "-9999px";
        textArea.style.left = "-9999px";
        textArea.style.opacity = "0";
        textArea.style.pointerEvents = "none";
        textArea.setAttribute("readonly", "");
        
        document.body.appendChild(textArea);
        
        textArea.focus();
        textArea.select();
        textArea.setSelectionRange(0, 99999);
        
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        
        if (successful) {
          resolve();
        } else {
          reject(new Error("execCommand failed"));
        }
      } catch (err) {
        reject(err);
      }
    });
  };

  const handleCopy = async () => {
    if (!text || text.trim() === "" || text === "—") {
      return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        await fallbackCopy(text);
      }
      
      setIsCopied(true);
      
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
      
    } catch (err) {
      console.error("Clipboard operation failed:", err);
    }
  };

  if (!text || text === "—") {
    return null;
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className={`h-4 min-w-4 p-1 hover:bg-gray-100 text-xs ${className}`}
      onClick={handleCopy}
      title={`Copy ${label.toLowerCase()}`}
    >
      {isCopied ? (
        <span className="text-green-600">Copied</span>
      ) : (
        <svg
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
    </Button>
  );
}