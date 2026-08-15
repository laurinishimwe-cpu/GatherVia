"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DeleteConfirmModal } from "@/components/dashboard/DeleteConfirmModal";
import { useToast } from "@/components/providers/ToastProvider";
import { deleteTemplate, fetchAllTemplates } from "@/lib/api/admin";
import type { FlyerTemplate } from "@/lib/types/flyer";

export default function TemplateManager() {
  const router = useRouter();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<FlyerTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<FlyerTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setTemplates(await fetchAllTemplates());
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not load templates.", "error");
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteTemplate(deleteTarget.id);
      setTemplates((current) => current.filter((template) => template.id !== deleteTarget.id));
      toast("Template deleted.", "success");
      setDeleteTarget(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not delete template.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Templates</h1>
        <button
          onClick={() => router.push("/admin/templates/new")}
          className="rounded-full bg-brand-400 px-4 py-2 text-sm font-semibold text-black"
        >
          + Add Template
        </button>
      </div>
      {isLoading ? (
        <p>Loading…</p>
      ) : templates.length === 0 ? (
        <div className="py-12 text-center text-foreground/50">
          <p className="text-lg">No custom templates yet</p>
          <p className="mt-2 text-sm">Create your first template to get started.</p>
          <button
            onClick={() => router.push("/admin/templates/new")}
            className="mt-4 rounded-full bg-brand-400 px-4 py-2 text-sm font-semibold text-black"
          >
            + Add Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <article
              key={template.id}
              className="group cursor-pointer rounded-xl border border-brand-400/10 bg-background p-4 transition hover:border-brand-400/40"
              onClick={() => router.push(`/admin/templates/${template.id}`)}
            >
              <div
                className="mb-3 h-32 w-full rounded-lg"
                style={{ background: template.canvas_background_color }}
              />
              <p className="font-semibold">{template.title}</p>
              <p className="text-xs text-foreground/60">{template.event_type}</p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    router.push(`/admin/templates/${template.id}`);
                  }}
                  className="text-xs text-brand-400 hover:text-brand-300"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeleteTarget(template);
                  }}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <DeleteConfirmModal
        open={deleteTarget !== null}
        eventTitle={deleteTarget?.title ?? "this template"}
        itemLabel="template"
        isDeleting={isDeleting}
        onCancel={() => {
          if (!isDeleting) setDeleteTarget(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
