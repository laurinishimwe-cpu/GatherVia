"use client";

import {
  LayoutTemplate,
  Plus,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useState,
  type FormEvent,
} from "react";

import { AdminModal } from "@/components/admin/AdminModal";
import { TemplateGallery } from "@/components/dashboard/TemplateGallery";
import {
  deleteTemplate,
} from "@/lib/api/admin";
import {
  TEMPLATE_CATEGORIES,
  getTemplateCategoryLabel,
} from "@/lib/constants/template-categories";
import type {
  FlyerTemplate,
  TemplateCategory,
} from "@/lib/types/flyer";

export default function AdminDashboard() {
  const router = useRouter();

  const [activeCategory, setActiveCategory] =
    useState<TemplateCategory>("wedding");

  const [isCreateModalOpen, setIsCreateModalOpen] =
    useState(false);

  const [templateName, setTemplateName] =
    useState("");

  const [templateCategory, setTemplateCategory] =
    useState<TemplateCategory>("wedding");

  const [createError, setCreateError] =
    useState("");

  const [deleteTarget, setDeleteTarget] =
    useState<FlyerTemplate | null>(null);

  const [deleteError, setDeleteError] =
    useState("");

  const [isDeleting, setIsDeleting] =
    useState(false);

  const [galleryRefreshToken, setGalleryRefreshToken] =
    useState(0);

  const openTemplate = useCallback(
    (template: FlyerTemplate) => {
      router.push(
        `/admin/templates/${encodeURIComponent(template.id)}`,
      );
    },
    [router],
  );

  const openCreateModal = useCallback(() => {
    setTemplateName("");
    setTemplateCategory(activeCategory);
    setCreateError("");
    setIsCreateModalOpen(true);
  }, [activeCategory]);

  const closeCreateModal = useCallback(() => {
    setIsCreateModalOpen(false);
    setCreateError("");
  }, []);

  const handleCreateTemplate = (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const normalizedName = templateName.trim();

    if (!normalizedName) {
      setCreateError("Enter a template name.");
      return;
    }

    const searchParams = new URLSearchParams({
      name: normalizedName,
      category: templateCategory,
    });

    router.push(
      `/admin/templates/new?${searchParams.toString()}`,
    );
  };

  const requestTemplateDelete = useCallback(
    (template: FlyerTemplate) => {
      setDeleteError("");
      setDeleteTarget(template);
    },
    [],
  );

  const closeDeleteModal = useCallback(() => {
    if (isDeleting) {
      return;
    }

    setDeleteTarget(null);
    setDeleteError("");
  }, [isDeleting]);

  const confirmTemplateDelete = useCallback(async () => {
    if (!deleteTarget || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      await deleteTemplate(deleteTarget.id);

      setDeleteTarget(null);
      setGalleryRefreshToken(
        (current) => current + 1,
      );
    } catch (error) {
      console.error(
        "Unable to delete template",
        error,
      );

      setDeleteError(
        error instanceof Error
          ? error.message
          : "The template could not be deleted.",
      );
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, isDeleting]);

  return (
    <>
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[30px] border border-brand-400/15 bg-brand-400/[0.045] px-5 py-6 shadow-lg sm:px-7 sm:py-7">
          <div className="pointer-events-none absolute -right-20 -top-24 h-60 w-60 rounded-full bg-brand-400/10 blur-3xl" />

          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-400/10 text-brand-400">
                <LayoutTemplate
                  aria-hidden="true"
                  className="h-6 w-6"
                  strokeWidth={1.9}
                />
              </span>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">
                    Template studio
                  </p>

                  <span className="rounded-full border border-brand-400/15 bg-background/60 px-2.5 py-1 text-[10px] font-semibold text-foreground/50">
                    {getTemplateCategoryLabel(
                      activeCategory,
                    )}
                  </span>
                </div>

                <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                  Invitation templates
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/55">
                  Create, preview, edit and organise
                  the designs published in GatherVia.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-brand-400 px-5 text-sm font-semibold text-brand-950 transition hover:-translate-y-0.5 hover:bg-brand-500 hover:shadow-[0_14px_34px_rgba(79,214,190,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Plus
                aria-hidden="true"
                className="h-4 w-4"
                strokeWidth={2.3}
              />
              Add template
            </button>
          </div>
        </section>

        <section className="rounded-[30px] border border-brand-400/10 bg-background p-4 shadow-lg sm:p-6">
          <div className="flex flex-col gap-2 border-b border-brand-400/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-400">
                Template library
              </p>

              <h2 className="mt-2 text-xl font-semibold sm:text-2xl">
                Browse by category
              </h2>
            </div>

            <p className="text-xs text-foreground/45">
              Open a design to edit it or remove it
              from MongoDB.
            </p>
          </div>

          <TemplateGallery
            variant="admin"
            selectionMode="callback"
            showHeading={false}
            activeCategory={activeCategory}
            onActiveCategoryChange={
              setActiveCategory
            }
            refreshToken={galleryRefreshToken}
            onSelectTemplate={openTemplate}
            onDeleteTemplate={
              requestTemplateDelete
            }
          />
        </section>
      </div>

      <AdminModal
        open={isCreateModalOpen}
        title="Create template"
        description="Set the initial name and gallery category before opening the editor."
        onClose={closeCreateModal}
        footer={
          <>
            <button
              type="button"
              onClick={closeCreateModal}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-brand-400/15 px-5 text-sm font-semibold text-foreground/65 transition hover:border-brand-400/30 hover:bg-brand-400/5 hover:text-foreground"
            >
              Cancel
            </button>

            <button
              type="submit"
              form="create-template-form"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-400 px-5 text-sm font-semibold text-brand-950 transition hover:bg-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Plus
                aria-hidden="true"
                className="h-4 w-4"
                strokeWidth={2.2}
              />
              Continue to editor
            </button>
          </>
        }
      >
        <form
          id="create-template-form"
          onSubmit={handleCreateTemplate}
          className="space-y-5"
        >
          <div>
            <label
              htmlFor="template-name"
              className="text-sm font-medium"
            >
              Template name
            </label>

            <input
              id="template-name"
              type="text"
              autoFocus
              value={templateName}
              onChange={(event) => {
                setTemplateName(event.target.value);

                if (createError) {
                  setCreateError("");
                }
              }}
              placeholder="Elegant evening invitation"
              className="mt-2 h-12 w-full rounded-2xl border border-brand-400/15 bg-background px-4 text-sm outline-none transition placeholder:text-foreground/30 focus:border-brand-400/45 focus:ring-2 focus:ring-brand-400/15"
            />
          </div>

          <div>
            <label
              htmlFor="template-category"
              className="text-sm font-medium"
            >
              Category
            </label>

            <select
              id="template-category"
              value={templateCategory}
              onChange={(event) => {
                setTemplateCategory(
                  event.target.value as TemplateCategory,
                );
              }}
              className="mt-2 h-12 w-full rounded-2xl border border-brand-400/15 bg-background px-4 text-sm outline-none transition focus:border-brand-400/45 focus:ring-2 focus:ring-brand-400/15"
            >
              {TEMPLATE_CATEGORIES.map(
                (category) => (
                  <option
                    key={category.value}
                    value={category.value}
                  >
                    {category.label}
                  </option>
                ),
              )}
            </select>

            <p className="mt-2 text-xs leading-5 text-foreground/45">
              The category currently open in the
              gallery is selected by default.
            </p>
          </div>

          {createError ? (
            <p className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-400">
              {createError}
            </p>
          ) : null}
        </form>
      </AdminModal>

      <AdminModal
        open={deleteTarget !== null}
        title="Delete template?"
        description="This permanently removes the template from the library."
        onClose={closeDeleteModal}
        closeDisabled={isDeleting}
        footer={
          <>
            <button
              type="button"
              disabled={isDeleting}
              onClick={closeDeleteModal}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-brand-400/15 px-5 text-sm font-semibold text-foreground/65 transition hover:border-brand-400/30 hover:bg-brand-400/5 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isDeleting}
              onClick={() => {
                void confirmTemplateDelete();
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-red-500 px-5 text-sm font-semibold text-white transition hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60"
            >
              {isDeleting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Trash2
                  aria-hidden="true"
                  className="h-4 w-4"
                  strokeWidth={2.1}
                />
              )}

              {isDeleting
                ? "Deleting…"
                : "Delete template"}
            </button>
          </>
        }
      >
        {deleteTarget ? (
          <div className="rounded-2xl border border-red-400/15 bg-red-400/[0.035] p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-400/10 text-red-400">
                <Trash2
                  aria-hidden="true"
                  className="h-5 w-5"
                  strokeWidth={1.9}
                />
              </span>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {deleteTarget.title}
                </p>

                <p className="mt-1 break-all text-xs text-foreground/50">
                  {getTemplateCategoryLabel(
                    deleteTarget.category,
                  )}
                  {" · "}
                  {deleteTarget.id}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {deleteError ? (
          <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-400">
            {deleteError}
          </p>
        ) : null}
      </AdminModal>
    </>
  );
}