"use client";

import {
  LoaderCircle,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";
import {
  useParams,
  useRouter,
  useSearchParams,
} from "next/navigation";

import { AdminEditorShell } from "@/components/admin/AdminEditorShell";
import { AdminModal } from "@/components/admin/AdminModal";
import { useToast } from "@/components/providers/ToastProvider";
import {
  FlyerDraftProvider,
  useFlyerDraft,
} from "@/context/FlyerDraftContext";
import {
  createTemplate,
  fetchAllTemplates,
  updateTemplate,
} from "@/lib/api/admin";
import {
  TEMPLATE_CATEGORIES,
  getTemplateCategoryLabel,
} from "@/lib/constants/template-categories";
import { buildFlyerTemplateDraft } from "@/lib/flyer/template-preview";
import type {
  EventType,
} from "@/lib/types/event";
import {
  DEFAULT_FLYER_CONFIGURATION,
  type FlyerTemplate,
  type TemplateCategory,
} from "@/lib/types/flyer";

const TEMPLATE_LIBRARY_PATH = "/admin";

const DEFAULT_EVENT_TYPE_BY_CATEGORY = {
  wedding: "marriage",
  corporate: "corporate",
  birthday: "private",
  party: "private",
  conference: "conference",
  gala: "gala",
  other: "other",
} as const satisfies Record<
  TemplateCategory,
  EventType
>;

interface TemplateEditorInnerProps {
  template: FlyerTemplate | null;
  initialTitle: string;
  initialCategory: TemplateCategory;
}

function isTemplateCategory(
  value: string | null,
): value is TemplateCategory {
  return TEMPLATE_CATEGORIES.some(
    (category) =>
      category.value === value,
  );
}

function resolveTemplateCategory(
  value: string | null,
  fallback: TemplateCategory =
    "wedding",
): TemplateCategory {
  return isTemplateCategory(value)
    ? value
    : fallback;
}

function inferCategoryFromEventType(
  eventType: EventType,
): TemplateCategory {
  switch (eventType) {
    case "marriage":
      return "wedding";

    case "corporate":
      return "corporate";

    case "conference":
      return "conference";

    case "gala":
      return "gala";

    case "private":
      return "other";

    default:
      return "other";
  }
}

function getTemplateCategory(
  template: FlyerTemplate,
): TemplateCategory {
  const category =
    template.category;

  if (
    typeof category === "string" &&
    isTemplateCategory(category)
  ) {
    return category;
  }

  return inferCategoryFromEventType(
    template.event_type,
  );
}

function createTemplateId(
  title: string,
  category: TemplateCategory,
): string {
  const titleSlug = title
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  const safeTitle =
    titleSlug || "template";

  const suffix =
    Date.now().toString(36);

  return `${category}-${safeTitle}-${suffix}`;
}

function TemplateEditorInner({
  template,
  initialTitle,
  initialCategory,
}: TemplateEditorInnerProps) {
  const router = useRouter();
  const { toast } = useToast();

  const {
    draft,
    setFlyerDraft,
    unsavedWork,
  } = useFlyerDraft();

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    showLeaveModal,
    setShowLeaveModal,
  ] = useState(false);

  const templateTitle =
    template?.title.trim() ||
    initialTitle;

  const templateCategory =
    template
      ? getTemplateCategory(template)
      : initialCategory;

  const [
    resolvedTemplateId,
  ] = useState(() =>
    template?.id ??
    createTemplateId(
      templateTitle,
      templateCategory,
    ),
  );

  useEffect(() => {
    if (template) {
      const built =
        buildFlyerTemplateDraft(
          template,
        );

      setFlyerDraft({
        configuration:
          built.configuration,
        layers: built.layers,
        templateId: template.id,
        templateTitle:
          template.title,
        designLocked: false,
      });

      return;
    }

    setFlyerDraft({
      configuration:
        DEFAULT_FLYER_CONFIGURATION(
          1080,
          1920,
        ),
      layers: [],
      templateId:
        resolvedTemplateId,
      templateTitle,
      designLocked: false,
    });
  }, [
    resolvedTemplateId,
    setFlyerDraft,
    template,
    templateTitle,
  ]);

  useEffect(() => {
    if (!unsavedWork) {
      return;
    }

    const handleBeforeUnload = (
      event: BeforeUnloadEvent,
    ) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener(
      "beforeunload",
      handleBeforeUnload,
    );

    return () => {
      window.removeEventListener(
        "beforeunload",
        handleBeforeUnload,
      );
    };
  }, [unsavedWork]);

  const leaveEditor = () => {
    setShowLeaveModal(false);
    router.push(
      TEMPLATE_LIBRARY_PATH,
    );
  };

  const requestBack = () => {
    if (isSaving) {
      return;
    }

    if (unsavedWork) {
      setShowLeaveModal(true);
      return;
    }

    leaveEditor();
  };

  const saveTemplate = async () => {
    if (
      isSaving ||
      !draft.configuration
    ) {
      return;
    }

    if (draft.layers.length === 0) {
      toast(
        "Add at least one layer before saving.",
        "error",
      );
      return;
    }

    const eventType =
      template?.event_type ??
      DEFAULT_EVENT_TYPE_BY_CATEGORY[
        templateCategory
      ];

    const payload: FlyerTemplate = {
      id: resolvedTemplateId,
      category: templateCategory,
      event_type: eventType,
      title: templateTitle,
      description:
        template?.description ?? "",
      headline:
        template?.headline ??
        templateTitle,
      subheadline:
        template?.subheadline ?? "",
      accent_color:
        draft.configuration
          .stub_accent_color,
      canvas_background_color:
        draft.configuration
          .canvas_background_color,
      qr_foreground_color:
        draft.configuration
          .qr_foreground_color,
      qr_background_color:
        draft.configuration
          .qr_background_color,
      qr_background_transparent:
        draft.configuration
          .qr_background_transparent,
      configuration:
        draft.configuration,
      layers: draft.layers,
    };

    setIsSaving(true);

    try {
      if (template) {
        await updateTemplate(
          template.id,
          payload,
        );
      } else {
        await createTemplate(payload);
      }

      toast(
        "Template saved.",
        "success",
      );

      router.push(
        TEMPLATE_LIBRARY_PATH,
      );
    } catch (error) {
      console.error(
        "Unable to save template",
        error,
      );

      toast(
        error instanceof Error
          ? error.message
          : "Failed to save template.",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const saveDisabled =
    !draft.configuration ||
    draft.layers.length === 0;

  return (
    <>
      <AdminEditorShell
        templateTitle={
          templateTitle
        }
        categoryLabel={
          getTemplateCategoryLabel(
            templateCategory,
          )
        }
        isSaving={isSaving}
        saveDisabled={
          saveDisabled
        }
        hasUnsavedChanges={
          unsavedWork
        }
        onBack={requestBack}
        onSave={() => {
          void saveTemplate();
        }}
      />

      <AdminModal
        open={showLeaveModal}
        title="Leave without saving?"
        description="Your recent template changes will be lost."
        onClose={() => {
          setShowLeaveModal(false);
        }}
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setShowLeaveModal(false);
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-brand-400/15 px-5 text-sm font-semibold text-foreground/65 transition hover:border-brand-400/30 hover:bg-brand-400/5 hover:text-foreground"
            >
              Stay in editor
            </button>

            <button
              type="button"
              onClick={leaveEditor}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-red-500 px-5 text-sm font-semibold text-white transition hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Discard and leave
            </button>
          </>
        }
      >
        <div className="rounded-2xl border border-red-400/15 bg-red-400/[0.035] p-4">
          <p className="text-sm font-semibold">
            {templateTitle}
          </p>

          <p className="mt-1 text-xs text-foreground/50">
            {getTemplateCategoryLabel(
              templateCategory,
            )}
          </p>
        </div>
      </AdminModal>
    </>
  );
}

export default function TemplateEditorPage() {
  const params = useParams<{
    id: string;
  }>();

  const router = useRouter();
  const searchParams =
    useSearchParams();

  const templateId =
    params.id;

  const isNew =
    templateId === "new";

  const queryTitle =
    searchParams
      .get("name")
      ?.trim() ||
    "Untitled template";

  const queryCategory =
    resolveTemplateCategory(
      searchParams.get(
        "category",
      ),
    );

  const [
    template,
    setTemplate,
  ] = useState<FlyerTemplate | null>(
    null,
  );

  const [
    isLoading,
    setIsLoading,
  ] = useState(!isNew);

  useEffect(() => {
    if (isNew) {
      return;
    }

    let cancelled = false;

    async function loadTemplate() {
      setIsLoading(true);

      try {
        const templates =
          await fetchAllTemplates();

        if (cancelled) {
          return;
        }

        const found =
          templates.find(
            (item) =>
              item.id ===
              templateId,
          ) ?? null;

        if (!found) {
          router.replace(
            TEMPLATE_LIBRARY_PATH,
          );
          return;
        }

        setTemplate(found);
      } catch (error) {
        console.error(
          "Unable to load template",
          error,
        );

        if (!cancelled) {
          router.replace(
            TEMPLATE_LIBRARY_PATH,
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadTemplate();

    return () => {
      cancelled = true;
    };
  }, [
    isNew,
    router,
    templateId,
  ]);

  return (
    <div className="fixed inset-0 z-[80] overflow-hidden bg-background text-foreground">
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-brand-400/10 bg-background px-5 py-4 text-sm text-foreground/55 shadow-lg">
            <LoaderCircle
              aria-hidden="true"
              className="h-4 w-4 animate-spin text-brand-400"
              strokeWidth={2}
            />

            Loading template…
          </div>
        </div>
      ) : (
        <FlyerDraftProvider scope="template">
          <TemplateEditorInner
            template={template}
            initialTitle={
              queryTitle
            }
            initialCategory={
              queryCategory
            }
          />
        </FlyerDraftProvider>
      )}
    </div>
  );
}
