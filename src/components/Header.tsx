"use client";

import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export default function Header() {
  return (
    <div className="flex items-center justify-between w-full bg-slate-800 rounded-xl border border-pink-500/30 shadow-lg shadow-pink-500/10 p-4 mb-4">
      <h1 className="text-3xl font-bold text-slate-100">
        MapMyHealth
      </h1>
      <ContextMenu>
        <ContextMenuTrigger>
          <div className="inline-flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-200 hover:text-slate-100 hover:bg-slate-700"
              aria-label="Profile"
            >
              <User className="w-6 h-6" />
            </Button>
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
  );
}
