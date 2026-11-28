"use client";

import { forwardRef } from "react";

/** Input de arquivo invisível reutilizável. */
export const HiddenFileInput = forwardRef<
  HTMLInputElement,
  { accept: string; capture?: "user" | "environment"; onFile: (f: File) => void }
>(function HiddenFileInput({ accept, capture, onFile }, ref) {
  return (
    <input
      ref={ref}
      type="file"
      accept={accept}
      capture={capture}
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) onFile(f);
      }}
    />
  );
});

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
export const AUDIO_ACCEPT = "audio/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.opus,.webm,.flac,.caf";
