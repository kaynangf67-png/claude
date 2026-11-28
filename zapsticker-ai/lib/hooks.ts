"use client";

import { useEffect, useState } from "react";
import { decodeAudio } from "./audio";
import { loadImage } from "./image";

export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

export function useImage(blob: Blob | null | undefined): { image: HTMLImageElement | null; error: string | null } {
  const [state, setState] = useState<{ image: HTMLImageElement | null; error: string | null }>({ image: null, error: null });
  useEffect(() => {
    let alive = true;
    if (!blob) {
      setState({ image: null, error: null });
      return;
    }
    loadImage(blob).then(
      (image) => alive && setState({ image, error: null }),
      (e: Error) => alive && setState({ image: null, error: e.message }),
    );
    return () => {
      alive = false;
    };
  }, [blob]);
  return state;
}

export function useAudioBuffer(blob: Blob | null | undefined): { buffer: AudioBuffer | null; error: string | null; loading: boolean } {
  const [state, setState] = useState<{ buffer: AudioBuffer | null; error: string | null; loading: boolean }>({
    buffer: null,
    error: null,
    loading: false,
  });
  useEffect(() => {
    let alive = true;
    if (!blob) {
      setState({ buffer: null, error: null, loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    decodeAudio(blob).then(
      (buffer) => alive && setState({ buffer, error: null, loading: false }),
      (e: Error) => alive && setState({ buffer: null, error: e.message, loading: false }),
    );
    return () => {
      alive = false;
    };
  }, [blob]);
  return state;
}

export function useIsTouch(): boolean {
  const [touch, setTouch] = useState(false);
  useEffect(() => setTouch(window.matchMedia("(pointer: coarse)").matches), []);
  return touch;
}
