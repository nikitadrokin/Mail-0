"use client";

import type { InitialThread, ThreadProps, MailListProps, MailSelectMode } from "@/types";
import { EmptyState, type FolderType } from "@/components/mail/empty-state";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn, defaultPageSize, formatDate } from "@/lib/utils";
import { useSearchValue } from "@/hooks/use-search-value";
import { markAsRead, markAsUnread } from "@/actions/mail";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMail } from "@/components/mail/use-mail";
import { useHotKey } from "@/hooks/use-hot-key";
import { useDrafts } from "@/hooks/use-drafts";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const highlightText = (text: string, highlight: string) => {
  if (!highlight?.trim()) return text;

  const regex = new RegExp(`(${highlight})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, i) => {
    return i % 2 === 1 ? (
      <span
        key={i}
        className="ring-0.5 bg-primary/10 inline-flex items-center justify-center rounded px-1"
      >
        {part}
      </span>
    ) : (
      part
    );
  });
};

const Draft = ({ message, onClick }: ThreadProps) => {
  const [mail] = useMail();
  const [searchValue] = useSearchValue();

  const isMailSelected = message.id === mail.selected;
  const isMailBulkSelected = mail.bulkSelected.includes(message.id);

  return (
    <div
      onClick={onClick ? onClick(message) : undefined}
      key={message.id}
      className={cn(
        "hover:bg-offsetLight hover:bg-primary/5 group relative flex cursor-pointer flex-col items-start overflow-clip rounded-lg border border-transparent px-4 py-3 text-left text-sm transition-all hover:opacity-100",
        !message.unread && "opacity-50",
        (isMailSelected || isMailBulkSelected) && "border-border bg-primary/5 opacity-100",
      )}
    >
      <div
        className={cn(
          "bg-primary absolute inset-y-0 left-0 w-1 -translate-x-2 transition-transform ease-out",
          isMailBulkSelected && "translate-x-0",
        )}
      />
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-1">
          <p
            className={cn(
              message.unread ? "font-bold" : "font-medium",
              "text-md flex items-baseline gap-1 group-hover:opacity-100",
            )}
          >
            <span className={cn(mail.selected && "max-w-[120px] truncate")}>
              {highlightText(message.sender.name, searchValue.highlight)}
            </span>
          </p>
        </div>
        {message.receivedOn ? (
          <p
            className={cn(
              "text-xs font-normal opacity-70 transition-opacity group-hover:opacity-100",
              isMailSelected && "opacity-100",
            )}
          >
            {formatDate(message.receivedOn.split(".")[0] || "")}
          </p>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-1 line-clamp-1 text-xs opacity-70 transition-opacity",
          mail.selected ? "line-clamp-1" : "line-clamp-2",
          isMailSelected && "opacity-100",
        )}
      >
        {highlightText(message.subject, searchValue.highlight)}
      </p>
    </div>
  );
};

export function DraftsList({ isCompact }: MailListProps) {
  const [mail, setMail] = useMail();
  const { data: session } = useSession();
  const [searchValue] = useSearchValue();
  const router = useRouter();

  const {
    data: { drafts: items, nextPageToken },
    isValidating,
    isLoading,
    loadMore,
  } = useDrafts(searchValue.value, defaultPageSize);

  const parentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemHeight = isCompact ? 64 : 96;

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => itemHeight,
  });

  const virtualItems = virtualizer.getVirtualItems();

  const handleScroll = useCallback(
    async (e: React.UIEvent<HTMLDivElement>) => {
      if (isLoading || isValidating) return;

      const target = e.target as HTMLDivElement;
      const { scrollTop, scrollHeight, clientHeight } = target;
      const scrolledToBottom = scrollHeight - (scrollTop + clientHeight) < itemHeight * 2;

      if (scrolledToBottom) {
        console.log("Loading more items...");
        await loadMore();
      }
    },
    [isLoading, isValidating, itemHeight, loadMore],
  );

  const [massSelectMode, setMassSelectMode] = useState(false);
  const [rangeSelectMode, setRangeSelectMode] = useState(false);
  const [selectAllBelowMode, setSelectAllBelowMode] = useState(false);

  const selectAll = useCallback(() => {
    // If there are already items selected, deselect them all
    if (mail.bulkSelected.length > 0) {
      setMail((prev) => ({
        ...prev,
        bulkSelected: [],
      }));
      toast.success("Deselected all emails");
    }
    // Otherwise select all items
    else if (items.length > 0) {
      const allIds = items.map((item) => item.id);
      setMail((prev) => ({
        ...prev,
        bulkSelected: allIds,
      }));
      toast.success(`Selected ${allIds.length} emails`);
    } else {
      toast.info("No emails to select");
    }
  }, [items, setMail, mail.bulkSelected]);

  const resetSelectMode = () => {
    setMassSelectMode(false);
    setRangeSelectMode(false);
    setSelectAllBelowMode(false);
  };

  useHotKey("Control", () => {
    resetSelectMode();
    setMassSelectMode(true);
  });

  useHotKey("Meta", () => {
    resetSelectMode();
    setMassSelectMode(true);
  });

  useHotKey("Shift", () => {
    resetSelectMode();
    setRangeSelectMode(true);
  });

  useHotKey("Alt+Shift", () => {
    resetSelectMode();
    setSelectAllBelowMode(true);
  });

  useHotKey("Meta+Shift+u", () => {
    resetSelectMode();
    void (async () => {
      const res = await markAsUnread({ ids: mail.bulkSelected });
      if (res.success) {
        toast.success("Marked as unread");
        setMail((prev) => ({
          ...prev,
          bulkSelected: [],
        }));
      } else toast.error("Failed to mark as unread");
    })();
  });

  useHotKey("Control+Shift+u", () => {
    resetSelectMode();
    void (async () => {
      const res = await markAsUnread({ ids: mail.bulkSelected });
      if (res.success) {
        toast.success("Marked as unread");
        setMail((prev) => ({
          ...prev,
          bulkSelected: [],
        }));
      } else toast.error("Failed to mark as unread");
    })();
  });

  useHotKey("Meta+Shift+i", () => {
    resetSelectMode();
    void (async () => {
      const res = await markAsRead({ ids: mail.bulkSelected });
      if (res.success) {
        toast.success("Marked as read");
        setMail((prev) => ({
          ...prev,
          bulkSelected: [],
        }));
      } else toast.error("Failed to mark as read");
    })();
  });

  useHotKey("Control+Shift+i", () => {
    resetSelectMode();
    void (async () => {
      const res = await markAsRead({ ids: mail.bulkSelected });
      if (res.success) {
        toast.success("Marked as read");
        setMail((prev) => ({
          ...prev,
          bulkSelected: [],
        }));
      } else toast.error("Failed to mark as read");
    })();
  });

  // useHotKey("Meta+Shift+j", async () => {
  //   resetSelectMode();
  //   const res = await markAsJunk({ ids: mail.bulkSelected });
  //   if (res.success) toast.success("Marked as junk");
  //   else toast.error("Failed to mark as junk");
  // });

  // useHotKey("Control+Shift+j", async () => {
  //   resetSelectMode();
  //   const res = await markAsJunk({ ids: mail.bulkSelected });
  //   if (res.success) toast.success("Marked as junk");
  //   else toast.error("Failed to mark as junk");
  // });

  useHotKey("Meta+a", (event) => {
    event?.preventDefault();
    resetSelectMode();
    selectAll();
  });

  useHotKey("Control+a", (event) => {
    event?.preventDefault();
    resetSelectMode();
    selectAll();
  });

  useHotKey("Meta+n", (event) => {
    event?.preventDefault();
    resetSelectMode();
    selectAll();
  });

  useHotKey("Control+n", (event) => {
    event?.preventDefault();
    resetSelectMode();
    selectAll();
  });

  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") {
        setMassSelectMode(false);
      }
      if (e.key === "Shift") {
        setRangeSelectMode(false);
      }
      if (e.key === "Alt") {
        setSelectAllBelowMode(false);
      }
    };

    const handleBlur = () => {
      setMassSelectMode(false);
      setRangeSelectMode(false);
      setSelectAllBelowMode(false);
    };

    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      setMassSelectMode(false);
      setRangeSelectMode(false);
      setSelectAllBelowMode(false);
    };
  }, []);

  const selectMode: MailSelectMode = massSelectMode
    ? "mass"
    : rangeSelectMode
      ? "range"
      : selectAllBelowMode
        ? "selectAllBelow"
        : "single";

  const handleMailClick = (message: InitialThread) => async () => {
    if (selectMode === "mass") {
      const updatedBulkSelected = mail.bulkSelected.includes(message.id)
        ? mail.bulkSelected.filter((id) => id !== message.id)
        : [...mail.bulkSelected, message.id];

      setMail({ ...mail, bulkSelected: updatedBulkSelected });
      return;
    }

    if (selectMode === "range") {
      const lastSelectedItem =
        mail.bulkSelected[mail.bulkSelected.length - 1] ?? mail.selected ?? message.id;

      const mailsIndex = items.map((m) => m.id);
      const startIdx = mailsIndex.indexOf(lastSelectedItem);
      const endIdx = mailsIndex.indexOf(message.id);

      if (startIdx !== -1 && endIdx !== -1) {
        const selectedRange = mailsIndex.slice(
          Math.min(startIdx, endIdx),
          Math.max(startIdx, endIdx) + 1,
        );

        setMail({ ...mail, bulkSelected: selectedRange });
      }
      return;
    }

    if (selectMode === "selectAllBelow") {
      const mailsIndex = items.map((m) => m.id);
      const startIdx = mailsIndex.indexOf(message.id);

      if (startIdx !== -1) {
        const selectedRange = mailsIndex.slice(startIdx);

        setMail({ ...mail, bulkSelected: selectedRange });
      }
      return;
    }

    router.push(`/create?draftId=${message.id}`);

    return;
  };

  const isEmpty = items.length === 0;
  const isFiltering = searchValue.value.trim().length > 0;

  if (isEmpty && session) {
    if (isFiltering) {
      return <EmptyState folder="search" className="min-h-[90vh] md:min-h-[90vh]" />;
    }
    return <EmptyState folder={"draft" as FolderType} className="min-h-[90vh] md:min-h-[90vh]" />;
  }

  return (
    <ScrollArea
      ref={scrollRef}
      className="h-full pb-2"
      type="scroll"
      onScrollCapture={handleScroll}
    >
      <div
        ref={parentRef}
        className={cn(
          "relative min-h-[calc(100vh-4rem)] w-full",
          selectMode === "range" && "select-none",
        )}
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          willChange: "transform",
          contain: "paint",
        }}
      >
        <div
          style={{
            transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
            willChange: "transform",
            contain: "paint",
          }}
          className="absolute left-0 top-0 w-full p-[8px]"
        >
          {virtualItems.map(({ index }) => {
            const item = items[index];
            return item ? (
              <Draft
                key={item.id}
                onClick={handleMailClick}
                message={item}
                selectMode={selectMode}
                isCompact={isCompact}
              />
            ) : null;
          })}
          <div className="w-full pt-2 text-center">
            {isLoading || isValidating ? (
              <div className="text-center">
                <div className="mx-auto h-4 w-4 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent dark:border-white dark:border-t-transparent" />
              </div>
            ) : (
              <div className="h-4" />
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
