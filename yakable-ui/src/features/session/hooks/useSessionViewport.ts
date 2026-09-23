import { useCallback, useRef, useState } from 'react';

const SCROLL_BOTTOM_THRESHOLD_PX = 120;
const HISTORY_LOAD_THRESHOLD_PX = 80;

interface UseSessionViewportOptions {
  hasNewer: boolean;
  loadOlder: () => Promise<boolean>;
  loadNewer: () => Promise<boolean>;
  restoreLatest: (signal?: AbortSignal) => Promise<boolean>;
  onError: (message: string) => void;
}

function isNearBottom(element: HTMLElement) {
  return (
    element.scrollHeight - element.scrollTop - element.clientHeight <= SCROLL_BOTTOM_THRESHOLD_PX
  );
}

export function useSessionViewport({
  hasNewer,
  loadOlder,
  loadNewer,
  restoreLatest,
  onError,
}: UseSessionViewportOptions) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const followLatestRef = useRef(true);
  const initialScrollDoneRef = useRef(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const setFollowLatest = useCallback((followLatest: boolean) => {
    followLatestRef.current = followLatest;
    setShowScrollBottom(!followLatest);
  }, []);

  const isFollowingLatest = useCallback(() => followLatestRef.current, []);

  const scrollToBottom = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    setFollowLatest(true);
    element.scrollTop = element.scrollHeight;
  }, [setFollowLatest]);

  const loadOlderMessages = useCallback(async () => {
    const element = scrollRef.current;
    if (!element) return;

    const previousScrollHeight = element.scrollHeight;

    try {
      const loaded = await loadOlder();
      if (!loaded) return;

      window.requestAnimationFrame(() => {
        const currentElement = scrollRef.current;
        if (!currentElement) return;
        currentElement.scrollTop += currentElement.scrollHeight - previousScrollHeight;
      });
    } catch (requestError) {
      onError(
        requestError instanceof Error ? requestError.message : 'Unable to load earlier messages.',
      );
    }
  }, [loadOlder, onError]);

  const loadNewerMessages = useCallback(async () => {
    try {
      await loadNewer();
    } catch (requestError) {
      onError(
        requestError instanceof Error ? requestError.message : 'Unable to load newer messages.',
      );
    }
  }, [loadNewer, onError]);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    setFollowLatest(isNearBottom(element));

    if (element.scrollTop <= HISTORY_LOAD_THRESHOLD_PX) {
      void loadOlderMessages();
    }

    if (
      hasNewer &&
      element.scrollHeight - element.scrollTop - element.clientHeight <= HISTORY_LOAD_THRESHOLD_PX
    ) {
      void loadNewerMessages();
    }
  }, [hasNewer, loadNewerMessages, loadOlderMessages, setFollowLatest]);

  const syncToContent = useCallback(
    (loadedSessionId: string | null) => {
      if (!loadedSessionId) return;

      if (!initialScrollDoneRef.current) {
        initialScrollDoneRef.current = true;
        scrollToBottom();
        return;
      }

      if (followLatestRef.current) {
        scrollToBottom();
      }
    },
    [scrollToBottom],
  );

  const restoreLatestView = useCallback(
    (scrollAfterRestore: boolean, cancelNavigationJump: () => void) => {
      cancelNavigationJump();
      setFollowLatest(true);

      if (!hasNewer) {
        if (scrollAfterRestore) {
          scrollToBottom();
        }
        return;
      }

      void restoreLatest()
        .then((restored) => {
          if (!restored || !scrollAfterRestore) return;

          window.requestAnimationFrame(() => {
            scrollToBottom();
          });
        })
        .catch((requestError: unknown) => {
          onError(
            requestError instanceof Error ? requestError.message : 'Unable to return to latest.',
          );
        });
    },
    [hasNewer, onError, restoreLatest, scrollToBottom, setFollowLatest],
  );

  return {
    scrollRef,
    showScrollBottom,
    setFollowLatest,
    isFollowingLatest,
    handleScroll,
    syncToContent,
    restoreLatestView,
  };
}
