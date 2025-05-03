'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { useState, useEffect, useContext, createContext, useCallback } from 'react';
import { AI_SIDEBAR_COOKIE_NAME, SIDEBAR_COOKIE_MAX_AGE } from '@/lib/constants';
import { StyledEmailAssistantSystemPrompt } from '@/actions/ai-composer-prompt';
import { ResizablePanelGroup, ResizablePanel } from '@/components/ui/resizable';
import { useEditor } from '@/components/providers/editor-provider';
import { AIChat } from '@/components/create/ai-chat';
import { X, Paper } from '@/components/icons/icons';
import { GitBranchPlus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHotkeys } from 'react-hotkeys-hook';
import { usePathname } from 'next/navigation';
import prompt from '@/app/api/chat/prompt';
import { getCookie } from '@/lib/utils';
import { Textarea } from './textarea';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface AISidebarProps {
  className?: string;
}

type AISidebarContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
};

export const AISidebarContext = createContext<AISidebarContextType | undefined>(undefined);

export function useAISidebar() {
  const context = useContext(AISidebarContext);
  if (!context) {
    throw new Error('useAISidebar must be used within an AISidebarProvider');
  }
  return context;
}

export function AISidebarProvider({ children }: { children: React.ReactNode }) {
  // Initialize state from cookie
  const [open, setOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const aiSidebarCookie = getCookie(AI_SIDEBAR_COOKIE_NAME);
      return aiSidebarCookie ? aiSidebarCookie === 'true' : false;
    }
    return false;
  });

  const toggleOpen = () => setOpen((prev) => !prev);

  // Save state to cookie when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.cookie = `${AI_SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    }
  }, [open]);

  return (
    <AISidebarContext.Provider value={{ open, setOpen, toggleOpen }}>
      <AISidebar>{children}</AISidebar>
    </AISidebarContext.Provider>
  );
}

export function AISidebar({ children, className }: AISidebarProps & { children: React.ReactNode }) {
  const { open, setOpen } = useAISidebar();
  const { editor } = useEditor();
  const [hasMessages, setHasMessages] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const pathname = usePathname();

  useHotkeys('Meta+0', () => {
    setOpen(!open);
  });

  useHotkeys('Control+0', () => {
    setOpen(!open);
  });

  const handleNewChat = useCallback(() => {
    setResetKey((prev) => prev + 1);
    setHasMessages(false);
  }, []);

  // Only show on /mail pages
  const isMailPage = pathname?.startsWith('/mail');
  if (!isMailPage) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider delayDuration={0}>
      <ResizablePanelGroup
        direction="horizontal"
        className={cn('bg-lightBackground dark:bg-darkBackground p-0')}
      >
        <ResizablePanel>{children}</ResizablePanel>

        {open && (
          <>
            <ResizablePanel
              defaultSize={25}
              minSize={20}
              maxSize={45}
              className="bg-panelLight dark:bg-panelDark ml- mr-1.5 mt-1 h-[calc(98vh+12px)] border-[#E7E7E7] shadow-sm md:rounded-2xl md:border md:shadow-sm dark:border-[#252525]"
            >
              <div className={cn('h-[calc(98vh+15px)]', 'flex flex-col', '', className)}>
                <div className="flex h-full flex-col">
                  <div className="relative flex items-center justify-between border-b border-[#E7E7E7] px-2.5 pb-[10px] pt-[17.6px] dark:border-[#252525]">
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => setOpen(false)}
                            variant="ghost"
                            className="md:h-fit md:px-2"
                          >
                            <X className="dark:fill-iconDark fill-iconLight" />
                            <span className="sr-only">Close chat</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Close chat</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" className="md:h-fit md:px-2 [&>svg]:size-3">
                          <Paper className="dark:fill-iconDark fill-iconLight h-3.5 w-3.5" />
                          <span>Prompts</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent
                        showOverlay={true}
                        className="dark:bg-panelDark bg-panelLight max-w-2xl rounded-2xl p-4"
                      >
                        <DialogHeader>
                          <DialogTitle>AI System Prompts</DialogTitle>
                          <DialogDescription>
                            We believe in Open Source, so we're open sourcing our AI system prompts.
                            Soon you will be able to customize them to your liking. For now, here
                            are the default prompts:
                          </DialogDescription>
                        </DialogHeader>
                        <div className="text-muted-foreground mb-1 mt-4 flex gap-2 text-sm">
                          <span>Zero Chat / System Prompt</span>
                          <Link
                            href={'https://github.com/Mail-0/Zero.git'}
                            target="_blank"
                            className="flex items-center gap-1 underline"
                          >
                            <span>Contribute</span>
                            <GitBranchPlus className="h-4 w-4" />
                          </Link>
                        </div>
                        <Textarea className="min-h-60" readOnly value={prompt} />
                        <div className="text-muted-foreground mb-1 mt-4 flex gap-2 text-sm">
                          <span>Zero Compose / System Prompt</span>
                          <Link
                            href={'https://github.com/Mail-0/Zero.git'}
                            target="_blank"
                            className="flex items-center gap-1 underline"
                          >
                            <span>Contribute</span>
                            <GitBranchPlus className="h-4 w-4" />
                          </Link>
                        </div>
                        <Textarea
                          className="min-h-60"
                          readOnly
                          value={StyledEmailAssistantSystemPrompt().trim()}
                        />
                      </DialogContent>
                    </Dialog>

                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={handleNewChat}
                            variant="ghost"
                            className="md:h-fit md:px-2"
                          >
                            <Plus className="dark:text-iconDark text-iconLight" />
                            <span className="sr-only">New chat</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>New chat</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="b relative flex-1 overflow-hidden">
                    <AIChat key={resetKey} />
                  </div>
                </div>
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </TooltipProvider>
  );
}

export default AISidebar;

// Add this style to the file to hide scrollbars
const noScrollbarStyle = `
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
`;

if (typeof document !== 'undefined') {
  // Add the style to the document head when on client
  const style = document.createElement('style');
  style.innerHTML = noScrollbarStyle;
  document.head.appendChild(style);
}
