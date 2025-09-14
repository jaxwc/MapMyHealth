"use client";

import { PanelRightOpen, PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useUIStore } from "@/app/state/uiStore";

export default function Header() {
  const { isPanelOpen, togglePanel } = useUIStore();

  return (
    <div className="flex items-center justify-between w-full bg-slate-800 rounded-xl border border-pink-500/30 shadow-lg shadow-pink-500/10 p-4 mb-4">
      <h1 className="text-3xl font-bold text-slate-100">
        MapMyHealth
      </h1>
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={togglePanel}
          className="text-pink-400 hover:text-pink-300 hover:bg-slate-700 flex items-center gap-2"
        >
          {isPanelOpen ? (
            <>
              <PanelRightClose className="w-5 h-5 drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]" />
              <span className="text-pink-400 font-medium">Close</span>
            </>
          ) : (
            <>
              <PanelRightOpen className="w-5 h-5 drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]" />
              <span className="text-pink-400 font-medium">Open Analysis</span>
            </>
          )}
        </Button>
        <ContextMenu>
          <ContextMenuTrigger>
            <div className="inline-flex items-center gap-3">
              <Avatar className="rounded-full border border-slate-600">
                <AvatarImage src="" alt="Profile" />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="bg-slate-800 text-slate-200 border border-slate-600">
            <ContextMenuItem>Sign In</ContextMenuItem>
            <ContextMenuItem>Sign Up</ContextMenuItem>
            <ContextMenuItem>Log Out</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    </div>
  );
}
