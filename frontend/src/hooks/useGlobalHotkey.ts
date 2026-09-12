import { useEffect } from "react";

// Hand-rolled global Ctrl/Cmd+<key> listener. @tanstack/hotkeys exists but is
// alpha-stage and built for apps with many configurable shortcuts - this app
// only needs one binding, so a plain window listener is the simpler and more
// stable choice. `preventDefault` stops the browser's own address-bar
// shortcut (Ctrl+K in Chrome, Cmd+K in Safari).
export function useGlobalHotkey(key: string, onTrigger: () => void): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isModifierPressed = event.metaKey || event.ctrlKey;
      if (!isModifierPressed || event.key.toLowerCase() !== key.toLowerCase()) {
        return;
      }
      event.preventDefault();
      onTrigger();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [key, onTrigger]);
}
