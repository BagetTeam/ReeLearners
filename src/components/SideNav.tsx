"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PanelLeftIcon, PlusIcon, Trash2Icon } from "lucide-react";

export default function SideNav() {
  const { user, isLoading } = useUser();
  const { state, toggleSidebar } = useSidebar();
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const upsertUser = useMutation(api.users.upsert);
  const deleteFeed = useMutation(api.feeds.deleteFeed);
  const initRef = useRef(false);
  const [deletingId, setDeletingId] = useState<Id<"feeds"> | null>(null);
  const collapsed = state === "collapsed";

  useEffect(() => {
    if (isLoading || !user || initRef.current) return;
    initRef.current = true;

    const run = async () => {
      try {
        if (!user.sub) {
          throw new Error("Missing Auth0 user id");
        }
        const id = await upsertUser({
          auth0Id: user.sub,
          email: user.email ?? `${user.sub.replace("|", "_")}@reelearners.local`,
          name: user.name ?? user.nickname ?? "ReeLearner",
          avatarUrl: user.picture ?? undefined,
        });
        setUserId(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to sync user");
      }
    };

    void run();
  }, [isLoading, upsertUser, user]);

  const feeds = useQuery(
    api.feeds.listByUser,
    userId ? { userId } : "skip",
  );

  const handleDelete = async (feedId: Id<"feeds">) => {
    setDeletingId(feedId);
    try {
      await deleteFeed({ feedId });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Sidebar collapsible="offcanvas" variant="sidebar">
      <SidebarHeader className="gap-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-xs font-bold uppercase tracking-[0.2em] text-white dark:bg-zinc-100 dark:text-black">
              RL
            </span>
            {!collapsed && <span className="text-sm">ReeLearners</span>}
          </Link>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <PanelLeftIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            </TooltipContent>
          </Tooltip>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="New prompt">
              <Link href="/">
                <PlusIcon />
                <span>New prompt</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Prompt history</SidebarGroupLabel>
          <SidebarMenu>
            {isLoading && (
              <SidebarMenuItem>
                <span className="px-2 py-1 text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
                  Loading history...
                </span>
              </SidebarMenuItem>
            )}
            {!isLoading && !user && (
              <SidebarMenuItem>
                <span className="px-2 py-1 text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
                  Sign in to save prompts.
                </span>
              </SidebarMenuItem>
            )}
            {error && (
              <SidebarMenuItem>
                <span className="px-2 py-1 text-xs text-red-500 group-data-[collapsible=icon]:hidden">
                  {error}
                </span>
              </SidebarMenuItem>
            )}
            {feeds?.length === 0 && (
              <SidebarMenuItem>
                <span className="px-2 py-1 text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
                  No prompts yet.
                </span>
              </SidebarMenuItem>
            )}
            {feeds?.map((feed) => (
              <SidebarMenuItem key={feed._id}>
                <SidebarMenuButton asChild tooltip={feed.prompt}>
                  <Link href={`/feed/${encodeURIComponent(feed._id)}`}>
                    <span>{feed.prompt}</span>
                  </Link>
                </SidebarMenuButton>
                <ConfirmDialog
                  title="Delete prompt?"
                  description={`Delete "${feed.prompt}" and all its reels? This cannot be undone.`}
                  confirmLabel="Delete"
                  isLoading={deletingId === feed._id}
                  onConfirm={() => handleDelete(feed._id)}
                  trigger={
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label="Delete prompt"
                          disabled={deletingId === feed._id}
                          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform opacity-0 group-hover/menu-item:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-50 group-data-[collapsible=icon]:hidden"
                        >
                          <Trash2Icon className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left">Delete</TooltipContent>
                    </Tooltip>
                  }
                />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {user ? (
              <SidebarMenuButton asChild tooltip="Log out">
                <a href="/auth/logout">Log out</a>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton asChild tooltip="Log in">
                <a href="/auth/login">Log in</a>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="px-2 text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
          Prompts are saved per user and resume where you left off.
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
