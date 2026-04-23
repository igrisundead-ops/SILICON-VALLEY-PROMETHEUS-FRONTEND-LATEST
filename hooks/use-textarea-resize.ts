'use client';

import { useEffect, useRef } from "react";

export function useTextareaResize(value: string, minRows = 1) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto";

    // Calculate the minimum height based on minRows
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
    const minHeight = lineHeight * minRows;

    // Set the height to the larger of scrollHeight or minHeight
    textarea.style.height = `${Math.max(textarea.scrollHeight, minHeight)}px`;
  }, [value, minRows]);

  return textareaRef;
}
