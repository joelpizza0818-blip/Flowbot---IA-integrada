import { useEffect } from 'react';

export function useShortcuts({
  onClearChat,
  onToggleMemory,
  onToggleEphemeral,
  onOpenModelSelector,
  hasActiveAccount,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check for Ctrl + Shift
      if (e.ctrlKey && e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 'u':
            e.preventDefault();
            if (onClearChat) onClearChat();
            break;
          case 'k':
            e.preventDefault();
            if (onToggleMemory) onToggleMemory();
            break;
          case 'j':
            e.preventDefault();
            if (hasActiveAccount && onToggleEphemeral) {
              onToggleEphemeral();
            }
            break;
          case 'l':
            e.preventDefault();
            if (hasActiveAccount && onOpenModelSelector) {
              onOpenModelSelector();
            }
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    onClearChat,
    onToggleMemory,
    onToggleEphemeral,
    onOpenModelSelector,
    hasActiveAccount,
  ]);
}
