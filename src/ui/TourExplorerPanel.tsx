import React, { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  RefreshCw,
  ExternalLink,
  ArrowDownToLine,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import type { FolderTreeNode } from "../../electron/shared/types";

/** Pixel widths — exported so the parent layout can use them for margin calculations. */
export const EXPLORER_WIDTH_EXPANDED = 300;
export const EXPLORER_WIDTH_COLLAPSED = 64;

interface TourExplorerPanelProps {
  toursFolderPath: string | null;
  toursFolderTree: FolderTreeNode[];
  isLoading: boolean;
  isMigrating: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSelectFolder: () => void;
  onRefresh: () => void;
  onOpenFile: (filePath: string) => void;
  onRevealFile: (filePath: string) => void;
  onMigrate: () => void;
}

interface TreeNodeProps {
  node: FolderTreeNode;
  depth: number;
  onOpenFile: (filePath: string) => void;
  onRevealFile: (filePath: string) => void;
}

/* ---------- Single tree node (recursive) ---------- */

function TreeNode({ node, depth, onOpenFile, onRevealFile }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const isFolder = node.type === "folder";
  const hasChildren = isFolder && node.children && node.children.length > 0;

  const handleClick = () => {
    if (isFolder) {
      setExpanded((prev) => !prev);
    } else {
      onOpenFile(node.path);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);
  const fileExtension = !isFolder ? node.name.split(".").pop()?.toLowerCase() : null;

  useEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return;

    contextMenuRef.current.style.left = `${contextMenu.x}px`;
    contextMenuRef.current.style.top = `${contextMenu.y}px`;
  }, [contextMenu]);

  return (
    <div className="tour-tree-node-group">
      <button
        type="button"
        className="tour-tree-item"
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        title={node.path}
      >
        <span className="tour-tree-indent-track" aria-hidden="true">
          {Array.from({ length: depth }).map((_, i) => (
            <span key={i} className="tour-tree-indent-cell">
              <span className="tour-tree-indent-guide" />
            </span>
          ))}
        </span>
        <span className={`tour-tree-chevron ${hasChildren ? "visible" : ""}`}>
          {hasChildren && (
            <ChevronRight size={12} className={`transition-transform duration-100 ${expanded ? "rotate-90" : ""}`} />
          )}
        </span>
        <span className="tour-tree-icon">
          {isFolder ? (expanded ? <FolderOpen size={14} /> : <Folder size={14} />) : <FileText size={14} />}
        </span>
        <span className="tour-tree-label" title={node.name}>{node.name}</span>
        {fileExtension && (
          <span className={`tour-tree-badge ${fileExtension === "pdf" ? "tour-tree-badge-pdf" : ""}`}>
            {fileExtension.toUpperCase()}
          </span>
        )}
      </button>

      {contextMenu && (
        <>
          <div className="tour-tree-context-backdrop" onClick={closeContextMenu} />
          <div ref={contextMenuRef} className="tour-tree-context-menu">
            {!isFolder && (
              <button type="button" onClick={() => { onOpenFile(node.path); closeContextMenu(); }}>
                <FileText size={13} /> Open File
              </button>
            )}
            <button type="button" onClick={() => { onRevealFile(node.path); closeContextMenu(); }}>
              <ExternalLink size={13} /> Reveal in Explorer
            </button>
          </div>
        </>
      )}

      {isFolder && expanded && node.children && (
        <div className="tour-tree-children">
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} onOpenFile={onOpenFile} onRevealFile={onRevealFile} />
          ))}
          {node.children.length === 0 && (
            <p className="tour-tree-empty-row tour-tree-label opacity-40 italic">
              <span className="tour-tree-indent-track" aria-hidden="true">
                {Array.from({ length: depth + 1 }).map((_, i) => (
                  <span key={i} className="tour-tree-indent-cell">
                    <span className="tour-tree-indent-guide" />
                  </span>
                ))}
              </span>
              <span className="tour-tree-empty-text">Empty</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Stats bar ---------- */

function TreeStats({ tree }: { tree: FolderTreeNode[] }) {
  let folders = 0;
  let files = 0;
  function count(nodes: FolderTreeNode[]) {
    for (const node of nodes) {
      if (node.type === "folder") { folders++; if (node.children) count(node.children); }
      else { files++; }
    }
  }
  count(tree);
  if (folders === 0 && files === 0) return null;

  return (
    <div className="tour-tree-stats">
      <span>{folders} {folders === 1 ? "tour" : "tours"}</span>
      <span className="tour-tree-stats-dot">·</span>
      <span>{files} {files === 1 ? "voucher" : "vouchers"}</span>
    </div>
  );
}

/* ---------- Main panel ---------- */

export function TourExplorerPanel({
  toursFolderPath,
  toursFolderTree,
  isLoading,
  isMigrating,
  collapsed,
  onToggleCollapse,
  onSelectFolder,
  onRefresh,
  onOpenFile,
  onRevealFile,
  onMigrate,
}: TourExplorerPanelProps) {
  if (collapsed) {
    return (
      <aside className="tour-explorer-collapsed group">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="absolute -left-3 top-4 z-50 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md border border-line text-steel hover:text-navy opacity-0 group-hover:opacity-100 transition-opacity"
          title="Open Tour Explorer"
        >
          <PanelRightOpen size={14} />
        </button>
        <div className="mt-12 flex flex-col items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cloud text-steel">
            <Folder size={20} />
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="tour-explorer group">
      {/* Floating Collapse Button - Outside */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="absolute -left-3 top-4 z-50 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md border border-line text-steel hover:text-navy opacity-0 group-hover:opacity-100 transition-opacity"
        title="Collapse panel"
      >
        <PanelRightClose size={14} />
      </button>

      <div className="tour-explorer-header">
        <h3 className="tour-explorer-title">TOUR EXPLORER</h3>
        <div className="tour-explorer-actions">
          {toursFolderPath && (
            <button type="button" className="tour-explorer-action-btn" onClick={onRefresh} title="Refresh" disabled={isLoading}>
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            </button>
          )}
          <button type="button" className="tour-explorer-action-btn" onClick={onSelectFolder} title={toursFolderPath ? "Change Root Folder" : "Select Root Folder"}>
            <FolderPlus size={14} />
          </button>
        </div>
      </div>

      <div className="tour-explorer-body thin-scrollbar">
        {!toursFolderPath ? (
          <div className="tour-explorer-empty">
            <div className="tour-explorer-empty-icon"><FolderPlus size={32} /></div>
            <p className="tour-explorer-empty-title">No Tours Folder</p>
            <p className="tour-explorer-empty-desc">Select or create a root folder to organize your vouchers by tour type and hotel.</p>
            <button type="button" className="tour-explorer-empty-btn" onClick={onSelectFolder}>
              <FolderPlus size={15} /> Select Tours Folder
            </button>
          </div>
        ) : (
          <>
            <div className="tour-explorer-root">
              <Folder size={13} />
              <span className="tour-explorer-root-path" title={toursFolderPath}>
                {toursFolderPath.split(/[\\/]/).pop() || "Tours"}
              </span>
              <button type="button" className="tour-explorer-action-btn ml-auto" onClick={() => onRevealFile(toursFolderPath)} title="Open in File Explorer">
                <ExternalLink size={12} />
              </button>
            </div>

            {toursFolderTree.length === 0 && !isLoading && (
              <div className="tour-explorer-migrate-banner">
                <p className="tour-explorer-migrate-title">Migration Required</p>
                <p className="tour-explorer-migrate-desc">Existing voucher files are not yet organized into the tour folder structure. Would you like to migrate them now?</p>
                <button type="button" className="tour-explorer-migrate-btn" onClick={onMigrate} disabled={isMigrating}>
                  <ArrowDownToLine size={13} /> {isMigrating ? "Migrating…" : "Migrate Files Now"}
                </button>
              </div>
            )}

            {isLoading && (
              <div className="tour-explorer-loading"><RefreshCw size={16} className="animate-spin" /><span>Scanning folders…</span></div>
            )}

            {!isLoading && toursFolderTree.length > 0 && (
              <div className="tour-tree">
                {toursFolderTree.map((node) => (
                  <TreeNode key={node.path} node={node} depth={0} onOpenFile={onOpenFile} onRevealFile={onRevealFile} />
                ))}
              </div>
            )}

            {!isLoading && <TreeStats tree={toursFolderTree} />}
          </>
        )}
      </div>
    </aside>
  );
}
