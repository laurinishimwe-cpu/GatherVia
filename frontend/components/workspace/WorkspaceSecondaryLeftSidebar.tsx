"use client";

import { useState } from "react";
import { useFlyerDraft } from "@/context/FlyerDraftContext";

interface SecondaryLeftSidebarProps {
  onClose: () => void;
}

export function WorkspaceSecondaryLeftSidebar({ onClose }: SecondaryLeftSidebarProps) {
  const { draft, selectLayer, removeLayer, moveLayerToIndex } = useFlyerDraft();
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => {
      (e.target as HTMLElement).style.opacity = "0.4";
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedId(null);
    (e.target as HTMLElement).style.opacity = "1";
  };

  const handleDragEnter = (e: React.DragEvent, targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const original = draft.layers;
    const draggedIdx = original.findIndex((l) => l.id === draggedId);
    const targetIdx = original.findIndex((l) => l.id === targetId);

    if (draggedIdx === -1 || targetIdx === -1) return;
    moveLayerToIndex(draggedId, targetIdx);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  return (
    <aside className="w-64 border-r border-brand-400/10 bg-background flex flex-col shadow-xl z-10">
      <div className="flex items-center justify-between p-4 border-b border-brand-400/10">
        <h3 className="text-sm font-semibold tracking-wide">Layers</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-brand-400/10 text-foreground/60 hover:text-foreground transition">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-custom">
        {draft.layers.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-foreground/40 text-xs border border-dashed border-brand-400/20 rounded-xl">
            No layers yet
          </div>
        )}

        {[...draft.layers].reverse().map((layer: any) => {
          const isSelected = draft.selectedLayerId === layer.id;
          
          // Display Name Logic
          const displayName = layer.name || (layer.type === "text" ? layer.text : layer.type);
          
          // Determine Icon natively by Type
          let Icon;
          if (layer.type === "text") {
            Icon = <span className="font-serif font-bold text-sm leading-none">T</span>;
          } else if (layer.type === "rect") {
            Icon = <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="2" /></svg>;
          } else if (layer.type === "ellipse") {
            Icon = <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>;
          } else if (layer.type === "polygon") {
            Icon = <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><polygon points="12,2 22,8 22,16 12,22 2,16 2,8" /></svg>;
          } else if (layer.type === "path") {
            Icon = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>;
          } else {
            Icon = <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
          }

          return (
            <div
              key={layer.id}
              draggable
              onDragStart={(e) => handleDragStart(e, layer.id)}
              onDragEnd={handleDragEnd}
              onDragEnter={(e) => handleDragEnter(e, layer.id)}
              onDragOver={handleDragOver}
              onClick={() => selectLayer(layer.id)}
              className={`group flex items-center gap-3 text-xs p-2.5 rounded-xl cursor-grab active:cursor-grabbing transition-all border ${
                isSelected ? "bg-brand-400/10 border-brand-400/40 shadow-sm" : "bg-background border-transparent hover:border-brand-400/20 hover:bg-brand-400/5"
              } ${draggedId === layer.id ? "opacity-40" : ""}`}
            >
              <div className="text-foreground/30 group-hover:text-foreground/60 transition cursor-grab">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
              </div>
              
              <div className={`opacity-80 ${isSelected ? "text-brand-400" : "text-foreground/70"}`}>
                {Icon}
              </div>

              <span className="flex-1 truncate font-medium capitalize">{displayName}</span>
              
              <button 
                onClick={(e) => { e.stopPropagation(); removeLayer(layer.id); }} 
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-red-400/70 hover:text-red-400 hover:bg-red-400/10 transition"
                title="Delete layer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
