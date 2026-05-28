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
  Search,
} from "lucide-react";
import type {
  FolderTreeNode,
  VoucherDocumentRecord,
  VoucherRevisionRecord,
} from "../../electron/shared/types";
import { DocumentHistoryPanel, RevisionHistoryPanel } from "./AppPanels";

/** Pixel widths — exported so the parent layout can use them for margin calculations. */
export const EXPLORER_WIDTH_EXPANDED = 300;
export const EXPLORER_WIDTH_COLLAPSED = 64;

interface TourExplorerPanelProps {
  toursFolderPath: string | null;
  toursFolderTree: FolderTreeNode[];
  toursFolderExists?: boolean;
  documentHistory: VoucherDocumentRecord[];
  voucherRevisions: VoucherRevisionRecord[];
  isLoading: boolean;
  isMigrating: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSelectFolder: () => void;
  onRefresh: () => void;
  onOpenFile: (filePath: string) => void;
  onRevealFile: (filePath: string) => void;
  onOpenDocument: (filePath: string) => void;
  onMigrate: () => void;
}

interface TreeNodeProps {
  node: FolderTreeNode;
  depth: number;
  onOpenFile: (filePath: string) => void;
  onRevealFile: (filePath: string) => void;
  autoExpand?: boolean;
  filterText?: string;
}

/* ---------- Single tree node (recursive) ---------- */

function TreeNode({
  node,
  depth,
  onOpenFile,
  onRevealFile,
  autoExpand,
  filterText,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
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
  const fileExtension = !isFolder
    ? node.name.split(".").pop()?.toLowerCase()
    : null;

  useEffect(() => {
    if (autoExpand) {
      setExpanded(true);
    }
  }, [autoExpand]);

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
            <ChevronRight
              size={12}
              className={`transition-transform duration-100 ${expanded ? "rotate-90" : ""}`}
            />
          )}
        </span>
        <span className="tour-tree-icon">
          {isFolder ? (
            expanded ? (
              <FolderOpen size={14} />
            ) : (
              <Folder size={14} />
            )
          ) : (
            <FileText size={14} />
          )}
        </span>
        <span className="tour-tree-label" title={node.name}>
          {node.name}
        </span>

        {/* Hover quick actions */}
        {!isFolder && (
          <div
            className="tour-tree-hover-actions mr-1.5 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="tour-tree-hover-btn"
              onClick={() => onRevealFile(node.path)}
              title="Reveal in File Explorer"
            >
              <ExternalLink size={10} />
            </button>
          </div>
        )}

        {fileExtension && (
          <span
            className={`tour-tree-badge ${fileExtension === "pdf" ? "tour-tree-badge-pdf" : ""}`}
          >
            {fileExtension.toUpperCase()}
          </span>
        )}
      </button>

      {contextMenu && (
        <>
          <div
            className="tour-tree-context-backdrop"
            onClick={closeContextMenu}
          />
          <div ref={contextMenuRef} className="tour-tree-context-menu">
            {!isFolder && (
              <button
                type="button"
                onClick={() => {
                  onOpenFile(node.path);
                  closeContextMenu();
                }}
              >
                <FileText size={13} /> Open File
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onRevealFile(node.path);
                closeContextMenu();
              }}
            >
              <ExternalLink size={13} /> Reveal in Explorer
            </button>
          </div>
        </>
      )}

      {isFolder && expanded && node.children && (
        <div className="tour-tree-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onOpenFile={onOpenFile}
              onRevealFile={onRevealFile}
              autoExpand={autoExpand}
              filterText={filterText}
            />
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
      if (node.type === "folder") {
        folders++;
        if (node.children) count(node.children);
      } else {
        files++;
      }
    }
  }
  count(tree);
  if (folders === 0 && files === 0) return null;

  return (
    <div className="tour-tree-stats">
      <span>
        {folders} {folders === 1 ? "tour" : "tours"}
      </span>
      <span className="tour-tree-stats-dot">·</span>
      <span>
        {files} {files === 1 ? "voucher" : "vouchers"}
      </span>
    </div>
  );
}

/* ---------- Main panel ---------- */

export function TourExplorerPanel({
  toursFolderPath,
  toursFolderTree,
  toursFolderExists = true,
  documentHistory,
  voucherRevisions,
  isLoading,
  isMigrating,
  collapsed,
  onToggleCollapse,
  onSelectFolder,
  onRefresh,
  onOpenFile,
  onRevealFile,
  onOpenDocument,
  onMigrate,
}: TourExplorerPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [flexes, setFlexes] = useState([1, 1, 1]);
  const [expanded, setExpanded] = useState([true, true, true]);
  const [isResizing, setIsResizing] = useState(false);
  const [hoveredSection, setHoveredSection] = useState<number | null>(null);
  const [filterText, setFilterText] = useState("");

  const getFilteredTree = (
    nodes: FolderTreeNode[],
    query: string,
  ): FolderTreeNode[] => {
    const q = query.toLowerCase().trim();
    const result: FolderTreeNode[] = [];

    const checkNode = (node: FolderTreeNode): FolderTreeNode | null => {
      const nameMatches = node.name.toLowerCase().includes(q);

      if (node.type === "folder" && node.children) {
        const filteredChildren: FolderTreeNode[] = [];

        for (const child of node.children) {
          const res = checkNode(child);
          if (res) {
            filteredChildren.push(res);
          }
        }

        if (nameMatches || filteredChildren.length > 0) {
          return {
            ...node,
            children: filteredChildren,
          };
        }
      } else {
        if (nameMatches) {
          return node;
        }
      }
      return null;
    };

    for (const node of nodes) {
      const res = checkNode(node);
      if (res) {
        result.push(res);
      }
    }

    return result;
  };

  const displayTree = filterText
    ? getFilteredTree(toursFolderTree, filterText)
    : toursFolderTree;

  const toggleExpanded = (index: number) => {
    setExpanded((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const startResize = (index: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    // Find nearest expanded panel above
    let topIdx = index;
    while (topIdx >= 0 && !expanded[topIdx]) topIdx--;

    // Find nearest expanded panel below
    let botIdx = index + 1;
    while (botIdx < expanded.length && !expanded[botIdx]) botIdx++;

    // Cannot resize if we don't have expanded panels on both sides
    if (topIdx < 0 || botIdx >= expanded.length) return;

    const startY = e.clientY;
    const startFlexes = [...flexes];
    const containerHeight =
      containerRef.current?.clientHeight || window.innerHeight;
    const totalFlex = flexes.reduce(
      (sum, val, i) => (expanded[i] ? sum + val : sum),
      0,
    );

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaFlex = (deltaY / containerHeight) * totalFlex;

      const newFlexes = [...startFlexes];
      newFlexes[topIdx] += deltaFlex;
      newFlexes[botIdx] -= deltaFlex;

      if (newFlexes[topIdx] < 0.1) {
        newFlexes[botIdx] -= 0.1 - newFlexes[topIdx];
        newFlexes[topIdx] = 0.1;
      }
      if (newFlexes[botIdx] < 0.1) {
        newFlexes[topIdx] -= 0.1 - newFlexes[botIdx];
        newFlexes[botIdx] = 0.1;
      }

      setFlexes(newFlexes);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
  };
  if (collapsed) {
    return (
      <aside className="tour-explorer-collapsed group">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="absolute -left-3 top-4 z-50 flex h-6 w-6 items-center justify-center rounded-full bg-surface shadow-md border border-line text-steel hover:text-navy opacity-0 group-hover:opacity-100 transition-opacity"
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
    <aside
      className="tour-explorer group flex flex-col h-full bg-surface"
      ref={containerRef}
    >
      {/* Floating Collapse Button - Outside */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="absolute -left-3 top-4 z-50 flex h-6 w-6 items-center justify-center rounded-full bg-surface shadow-md border border-line text-steel hover:text-navy opacity-0 group-hover:opacity-100 transition-opacity"
        title="Collapse panel"
      >
        <PanelRightClose size={14} />
      </button>

      {/* Section 1: Tour Explorer */}
      <div
        className="flex flex-col min-h-0 border-b border-line"
        style={{ flex: expanded[0] ? `${flexes[0]} 1 0%` : "0 0 auto" }}
      >
        <div
          className="tour-explorer-header shrink-0 cursor-pointer select-none hover:bg-cloud/50 transition-colors"
          onClick={() => toggleExpanded(0)}
        >
          <div className="flex items-center gap-1 w-full">
            <ChevronRight
              size={14}
              className={`text-steel transition-transform shrink-0 ${expanded[0] ? "rotate-90" : ""}`}
            />
            <h3 className="tour-explorer-title flex-1">TOUR EXPLORER</h3>
            {expanded[0] && (
              <div
                className="tour-explorer-actions"
                onClick={(e) => e.stopPropagation()}
              >
                {toursFolderPath && (
                  <button
                    type="button"
                    className="tour-explorer-action-btn"
                    onClick={onRefresh}
                    title="Refresh"
                    disabled={isLoading}
                  >
                    <RefreshCw
                      size={14}
                      className={isLoading ? "animate-spin" : ""}
                    />
                  </button>
                )}
                <button
                  type="button"
                  className="tour-explorer-action-btn"
                  onClick={onSelectFolder}
                  title={
                    toursFolderPath
                      ? "Change Root Folder"
                      : "Select Root Folder"
                  }
                >
                  <FolderPlus size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {expanded[0] && (
          <div
            className={`tour-explorer-body ${hoveredSection === 0 ? "show-scrollbar" : "hide-scrollbar"} bg-surface flex-1 overflow-y-auto min-h-0 ${isResizing ? "pointer-events-none select-none" : ""}`}
            onMouseEnter={() => setHoveredSection(0)}
            onMouseLeave={() => setHoveredSection(null)}
          >
            {toursFolderExists === false ? (
              <div className="tour-explorer-empty">
                <div className="tour-explorer-empty-icon text-red-500 animate-pulse">
                  <FolderPlus size={32} />
                </div>
                <p className="tour-explorer-empty-title">Folder Not Found</p>
                <p className="tour-explorer-empty-desc">
                  The configured Tours root folder was deleted or moved from its
                  location. Please locate or re-select the folder.
                </p>
                <button
                  type="button"
                  className="tour-explorer-empty-btn"
                  onClick={onSelectFolder}
                >
                  <FolderPlus size={15} /> Locate Tours Folder
                </button>
              </div>
            ) : !toursFolderPath ? (
              <div className="tour-explorer-empty">
                <div className="tour-explorer-empty-icon">
                  <FolderPlus size={32} />
                </div>
                <p className="tour-explorer-empty-title">No Tours Folder</p>
                <p className="tour-explorer-empty-desc">
                  Select or create a root folder to organize your vouchers by
                  tour type and hotel.
                </p>
                <button
                  type="button"
                  className="tour-explorer-empty-btn"
                  onClick={onSelectFolder}
                >
                  <FolderPlus size={15} /> Select Tours Folder
                </button>
              </div>
            ) : (
              <>
                <div className="tour-explorer-root">
                  <Folder size={13} />
                  <span
                    className="tour-explorer-root-path"
                    title={toursFolderPath}
                  >
                    {toursFolderPath.split(/[\\/]/).pop() || "Tours"}
                  </span>
                  <button
                    type="button"
                    className="tour-explorer-action-btn ml-auto"
                    onClick={() => onRevealFile(toursFolderPath)}
                    title="Open in File Explorer"
                  >
                    <ExternalLink size={12} />
                  </button>
                </div>

                {/* Highly productive filter input */}
                <div className="px-2 py-1.5 border-b border-line bg-surface flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-2.5 flex items-center text-steel">
                      <Search size={11} />
                    </span>
                    <input
                      type="text"
                      placeholder="Filter tours & vouchers..."
                      className="w-full rounded bg-cloud border border-line pl-7 pr-7 py-1 text-[11px] outline-none focus:border-navy focus:bg-surface transition-all placeholder:text-steel/50 font-medium"
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                    />
                    {filterText && (
                      <button
                        type="button"
                        onClick={() => setFilterText("")}
                        className="absolute inset-y-0 right-2.5 flex items-center text-steel hover:text-navy text-[10px] font-bold"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {toursFolderTree.length === 0 && !isLoading && (
                  <div className="tour-explorer-migrate-banner">
                    <p className="tour-explorer-migrate-title">
                      Migration Required
                    </p>
                    <p className="tour-explorer-migrate-desc">
                      Existing voucher files are not yet organized into the tour
                      folder structure. Would you like to migrate them now?
                    </p>
                    <button
                      type="button"
                      className="tour-explorer-migrate-btn"
                      onClick={onMigrate}
                      disabled={isMigrating}
                    >
                      <ArrowDownToLine size={13} />{" "}
                      {isMigrating ? "Migrating…" : "Migrate Files Now"}
                    </button>
                  </div>
                )}

                {isLoading && (
                  <div className="tour-explorer-loading">
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Scanning folders…</span>
                  </div>
                )}

                {!isLoading && displayTree.length > 0 && (
                  <div className="tour-tree">
                    {displayTree.map((node) => (
                      <TreeNode
                        key={node.path}
                        node={node}
                        depth={0}
                        onOpenFile={onOpenFile}
                        onRevealFile={onRevealFile}
                        autoExpand={!!filterText}
                        filterText={filterText}
                      />
                    ))}
                  </div>
                )}

                {!isLoading && filterText && displayTree.length === 0 && (
                  <div className="py-6 text-center text-steel text-[11px] font-medium italic">
                    No matching records found in search.
                  </div>
                )}

                {!isLoading && <TreeStats tree={displayTree} />}
              </>
            )}
          </div>
        )}
      </div>

      {/* Resizer 1 */}
      {expanded[0] && (expanded[1] || expanded[2]) && (
        <div
          className="h-1 bg-line cursor-ns-resize hover:bg-navy/50 active:bg-navy shrink-0 transition-colors z-10"
          onMouseDown={startResize(0)}
        />
      )}

      {/* Section 2: Document History */}
      <div
        className="flex flex-col min-h-0 border-b border-line"
        style={{ flex: expanded[1] ? `${flexes[1]} 1 0%` : "0 0 auto" }}
      >
        <div
          className="tour-explorer-header shrink-0 cursor-pointer select-none hover:bg-cloud/50 transition-colors"
          onClick={() => toggleExpanded(1)}
        >
          <div className="flex items-center gap-1 w-full">
            <ChevronRight
              size={14}
              className={`text-steel transition-transform shrink-0 ${expanded[1] ? "rotate-90" : ""}`}
            />
            <h3 className="tour-explorer-title flex-1">DOCUMENT HISTORY</h3>
            {documentHistory.length > 0 && (
              <span className="text-[9px] font-extrabold px-1.5 py-0.2 bg-navy/10 text-navy rounded-full mr-2">
                {documentHistory.length}
              </span>
            )}
          </div>
        </div>

        {expanded[1] && (
          <div
            className={`flex-1 overflow-y-auto ${hoveredSection === 1 ? "show-scrollbar" : "hide-scrollbar"} bg-surface p-2 min-h-0 ${isResizing ? "pointer-events-none select-none" : ""}`}
            onMouseEnter={() => setHoveredSection(1)}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <DocumentHistoryPanel
              documentHistory={documentHistory}
              onOpenDocument={onOpenDocument}
            />
          </div>
        )}
      </div>

      {/* Resizer 2 */}
      {(expanded[0] || expanded[1]) && expanded[2] && (
        <div
          className="h-1 bg-line cursor-ns-resize hover:bg-navy/50 active:bg-navy shrink-0 transition-colors z-10"
          onMouseDown={startResize(1)}
        />
      )}

      {/* Section 3: Revision History */}
      <div
        className="flex flex-col min-h-0"
        style={{ flex: expanded[2] ? `${flexes[2]} 1 0%` : "0 0 auto" }}
      >
        <div
          className="tour-explorer-header shrink-0 cursor-pointer select-none hover:bg-cloud/50 transition-colors"
          onClick={() => toggleExpanded(2)}
        >
          <div className="flex items-center gap-1 w-full">
            <ChevronRight
              size={14}
              className={`text-steel transition-transform shrink-0 ${expanded[2] ? "rotate-90" : ""}`}
            />
            <h3 className="tour-explorer-title flex-1">REVISION HISTORY</h3>
            {voucherRevisions.length > 0 && (
              <span className="text-[9px] font-extrabold px-1.5 py-0.2 bg-navy/10 text-navy rounded-full mr-2">
                {voucherRevisions.length}
              </span>
            )}
          </div>
        </div>

        {expanded[2] && (
          <div
            className={`flex-1 overflow-y-auto ${hoveredSection === 2 ? "show-scrollbar" : "hide-scrollbar"} bg-surface p-2 min-h-0 ${isResizing ? "pointer-events-none select-none" : ""}`}
            onMouseEnter={() => setHoveredSection(2)}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <RevisionHistoryPanel voucherRevisions={voucherRevisions} />
          </div>
        )}
      </div>
    </aside>
  );
}
