import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WindowControls } from "@/components/WindowControls";
import { useAuth } from "@/auth/AuthGate";
import { Avatar } from "@/modules/profile/Avatar";
import { ProfileDialog } from "@/modules/profile/ProfileDialog";
import { IS_MAC, KEY_SEP, USE_CUSTOM_WINDOW_CONTROLS } from "@/lib/platform";
import { usePreferencesStore } from "@/modules/settings/preferences";
import {
  getBindingTokens,
  SHORTCUTS,
  type ShortcutId,
} from "@/modules/shortcuts/shortcuts";
import type { Tab } from "@/modules/tabs";
import { TabBar } from "@/modules/tabs";
import {
  GridViewIcon,
  KeyboardIcon,
  LayoutTwoColumnIcon,
  LayoutTwoRowIcon,
  Login03Icon,
  Logout01Icon,
  Settings01Icon,
  SidebarLeftIcon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  SearchInline,
  type SearchInlineHandle,
  type SearchTarget,
} from "./SearchInline";

type Props = {
  tabs: Tab[];
  activeId: number;
  onSelect: (id: number) => void;
  onNew: () => void;
  onNewPrivate: () => void;
  onNewPreview: () => void;
  onNewEditor: () => void;
  onClose: (id: number) => void;
  /** Promote a preview (transient) tab to persistent. */
  onPin: (id: number) => void;
  onToggleSidebar: () => void;
  onSplit: (dir: "row" | "col") => void;
  /** Active tab is a terminal and below the per-tab pane cap. */
  canSplit: boolean;
  onOpenShortcuts: () => void;
  onOpenSettings: () => void;
  searchTarget: SearchTarget;
  searchRef: RefObject<SearchInlineHandle | null>;
  /** Phone/small-tablet layout: hide split, search, and keyboard shortcuts. */
  isMobile?: boolean;
};

const COMPACT_WIDTH = 720;

export function Header({
  tabs,
  activeId,
  onSelect,
  onNew,
  onNewPrivate,
  onNewPreview,
  onNewEditor,
  onClose,
  onPin,
  onToggleSidebar,
  onSplit,
  canSplit,
  onOpenShortcuts,
  onOpenSettings,
  searchTarget,
  searchRef,
  isMobile = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const userShortcuts = usePreferencesStore((s) => s.shortcuts);
  const { email, profile, signIn, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  const tokensFor = (id: ShortcutId): string => {
    const s = SHORTCUTS.find((s) => s.id === id);
    if (!s) return "";
    const bindings = userShortcuts[id] || s.defaultBindings;
    if (!bindings || bindings.length === 0) return "";
    return getBindingTokens(bindings[0]).join(KEY_SEP);
  };

  const shortcutLabel = useMemo(() => {
    const tokens = tokensFor("shortcuts.open");
    return tokens ? `Keyboard shortcuts (${tokens})` : "Keyboard shortcuts";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userShortcuts]);

  const splitRightTokens = tokensFor("pane.splitRight");
  const splitDownTokens = tokensFor("pane.splitDown");

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setCompact(w < COMPACT_WIDTH);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const shortcutsButton = (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      onClick={onOpenShortcuts}
      title={shortcutLabel}
    >
      <HugeiconsIcon icon={KeyboardIcon} size={16} strokeWidth={1.75} />
    </Button>
  );

  const settingsButton = (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      onClick={onOpenSettings}
      title="Settings"
    >
      <HugeiconsIcon icon={Settings01Icon} size={15} strokeWidth={1.75} />
    </Button>
  );

  const userMenu = email ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 rounded-md p-0 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Account"
        >
          {profile ? (
            <Avatar profile={profile} size={22} />
          ) : (
            <HugeiconsIcon icon={UserIcon} size={16} strokeWidth={1.75} />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {profile && (
          <>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Avatar profile={profile} size={28} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {profile.displayName}
                </p>
                <p className="truncate text-xs text-muted-foreground">{email}</p>
              </div>
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
          <HugeiconsIcon icon={UserIcon} size={14} strokeWidth={1.75} />
          <span className="flex-1">Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void signOut()}>
          <HugeiconsIcon icon={Logout01Icon} size={14} strokeWidth={1.75} />
          <span className="flex-1">Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 shrink-0 gap-1.5 rounded-md px-2 text-muted-foreground hover:bg-accent hover:text-foreground"
      onClick={signIn}
      title="Sign in"
    >
      <HugeiconsIcon icon={Login03Icon} size={15} strokeWidth={1.75} />
      <span className="text-xs">Sign in</span>
    </Button>
  );

  return (
    <div
      ref={rootRef}
      data-tauri-drag-region
      className={`flex h-10 shrink-0 items-center gap-2 border-b border-border/60 bg-card select-none ${
        IS_MAC ? "pr-2 pl-20" : "pr-0 pl-2"
      }`}
    >
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          onClick={onToggleSidebar}
          title="Toggle sidebar"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <HugeiconsIcon icon={SidebarLeftIcon} size={18} strokeWidth={1.75} />
        </Button>

        {!isMobile && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                title="Split terminal"
                disabled={!canSplit}
              >
                <HugeiconsIcon
                  icon={GridViewIcon}
                  size={16}
                  strokeWidth={1.75}
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-44">
              <DropdownMenuItem onSelect={() => onSplit("row")}>
                <HugeiconsIcon
                  icon={LayoutTwoColumnIcon}
                  size={14}
                  strokeWidth={1.75}
                />
                <span className="flex-1">Split right</span>
                {splitRightTokens && (
                  <span className="text-xs text-muted-foreground">
                    {splitRightTokens}
                  </span>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onSplit("col")}>
                <HugeiconsIcon
                  icon={LayoutTwoRowIcon}
                  size={14}
                  strokeWidth={1.75}
                />
                <span className="flex-1">Split down</span>
                {splitDownTokens && (
                  <span className="text-xs text-muted-foreground">
                    {splitDownTokens}
                  </span>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {!IS_MAC && !isMobile && shortcutsButton}
      </div>

      {!IS_MAC && <span className="mx-1 h-5 w-px shrink-0 bg-border" />}

      {IS_MAC && <span className="mr-1 h-full w-px shrink-0 bg-border" />}

      <div
        className="flex min-w-0 flex-1 items-center gap-2"
        data-tauri-drag-region
      >
        <TabBar
          tabs={tabs}
          activeId={activeId}
          onSelect={onSelect}
          onNew={onNew}
          onNewPrivate={onNewPrivate}
          onNewPreview={onNewPreview}
          onNewEditor={onNewEditor}
          onClose={onClose}
          onPin={onPin}
          compact={compact}
        />
        <div data-tauri-drag-region className="h-full min-w-2 flex-1" />
      </div>

      {!isMobile && (
        <SearchInline ref={searchRef} target={searchTarget} compact={compact} />
      )}

      {IS_MAC && (
        <>
          {!isMobile && shortcutsButton}
          {settingsButton}
          {userMenu}
        </>
      )}

      {!IS_MAC && (
        <>
          {settingsButton}
          {userMenu}
        </>
      )}

      {USE_CUSTOM_WINDOW_CONTROLS && (
        <>
          <span className="ml-1 h-5 w-px shrink-0 bg-border" />
          <WindowControls />
        </>
      )}

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}
