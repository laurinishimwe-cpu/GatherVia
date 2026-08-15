"use client";

import {
  ArrowUpRight,
  PencilLine,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { OriginalFlyer } from "@/components/workspace/flyer/OriginalFlyer";
import { useAuth } from "@/context/AuthContext";
import { useEventContext } from "@/context/EventContext";
import { fetchFlyerTemplates } from "@/lib/api/flyers";
import {
  TEMPLATE_CATEGORIES,
  getTemplateCategoryLabel,
} from "@/lib/constants/template-categories";
import { storePendingTemplate } from "@/lib/session/pending-flyer";
import {
  type FlyerConfiguration,
  type FlyerTemplate,
  type TemplateCategory,
} from "@/lib/types/flyer";
import { buildConfigurationFromTemplate } from "@/lib/flyer/template-preview";
import {
  SECURE_QR_BACKGROUND_COLOR,
  SECURE_QR_FOREGROUND_COLOR,
} from "@/lib/invitation/originalFlyerLayout";

type TemplateGalleryVariant =
  | "dashboard"
  | "landing"
  | "admin";

type TemplateSelectionMode =
  | "create-event"
  | "callback";

type GalleryCategory =
  | "all"
  | TemplateCategory;

const ALL_TEMPLATE_CATEGORY = {
  value: "all",
  label: "All",
  eyebrow: "All invitations",
} as const;

interface TemplateGalleryProps {
  variant?: TemplateGalleryVariant;
  selectionMode?: TemplateSelectionMode;
  onSelectTemplate?: (
    template: FlyerTemplate,
  ) => void | Promise<void>;
  onDeleteTemplate?: (
    template: FlyerTemplate,
  ) => void;
  maximumTemplates?: number;
  showHeading?: boolean;
  initialCategory?: GalleryCategory;
  activeCategory?: TemplateCategory;
  onActiveCategoryChange?: (
    category: TemplateCategory,
  ) => void;
  refreshToken?: number;
}

const PREVIEW_BASE_WIDTH = 340;
const PREVIEW_BASE_HEIGHT =
  (PREVIEW_BASE_WIDTH * 16) / 9;

function buildPreviewConfiguration(
  template: FlyerTemplate,
): FlyerConfiguration {
  return buildConfigurationFromTemplate(template);
}

function getTemplateQrValue(
  template: FlyerTemplate,
): string {
  const qrLayer = template.layers?.find(
    (layer) =>
      layer.type === "qr" &&
      typeof layer.qrValue === "string" &&
      layer.qrValue.trim().length > 0,
  );

  return (
    qrLayer?.qrValue?.trim() ||
    template.id
  );
}

function getCardWidthClasses(
  variant: TemplateGalleryVariant,
): string {
  if (variant === "landing") {
    return [
      "w-[232px] min-w-[232px]",
      "sm:w-[252px] sm:min-w-[252px]",
      "lg:w-[272px] lg:min-w-[272px]",
      "snap-start",
    ].join(" ");
  }

  return "w-full";
}

function TemplateSkeleton({
  variant,
}: {
  variant: TemplateGalleryVariant;
}) {
  return (
    <div
      aria-hidden="true"
      className={[
        getCardWidthClasses(variant),
        "overflow-hidden rounded-3xl",
        "border border-brand-400/10",
        "bg-background p-3",
      ].join(" ")}
    >
      <div className="aspect-[9/16] animate-pulse rounded-[18px] bg-foreground/5" />

      <div className="mt-4 flex h-[88px] flex-col px-2 pb-1">
        <div className="h-2.5 w-20 rounded-full bg-foreground/10" />
        <div className="mt-2 h-4 w-2/3 rounded-full bg-foreground/10" />
        <div className="mt-auto h-3 w-24 rounded-full bg-foreground/10" />
      </div>
    </div>
  );
}

function TemplateFlyerPreview({
  template,
}: {
  template: FlyerTemplate;
}) {
  const viewportRef =
    useRef<HTMLDivElement>(null);

  const [scale, setScale] =
    useState(1);

  const [qrSvg, setQrSvg] =
    useState("");

  const configuration = useMemo(
    () =>
      buildPreviewConfiguration(
        template,
      ),
    [template],
  );

  const qrValue = useMemo(
    () =>
      getTemplateQrValue(template),
    [template],
  );

  useEffect(() => {
    let cancelled = false;

    QRCode.toString(qrValue, {
      type: "svg",
      width: 240,
      margin: 1,
      color: {
        dark: SECURE_QR_FOREGROUND_COLOR,
        light: SECURE_QR_BACKGROUND_COLOR,
      },
    })
      .then((svg) => {
        if (!cancelled) {
          setQrSvg(svg);
        }
      })
      .catch((error) => {
        console.error(
          `Unable to generate QR preview for ${template.id}`,
          error,
        );

        if (!cancelled) {
          setQrSvg("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    qrValue,
    template.id,
  ]);

  useLayoutEffect(() => {
    const viewport =
      viewportRef.current;

    if (!viewport) {
      return;
    }

    const updateScale = () => {
      const width =
        viewport.getBoundingClientRect()
          .width;

      setScale(
        width / PREVIEW_BASE_WIDTH,
      );
    };

    updateScale();

    if (
      typeof ResizeObserver ===
      "undefined"
    ) {
      window.addEventListener(
        "resize",
        updateScale,
      );

      return () => {
        window.removeEventListener(
          "resize",
          updateScale,
        );
      };
    }

    const observer =
      new ResizeObserver(updateScale);

    observer.observe(viewport);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={viewportRef}
      className="relative aspect-[9/16] w-full overflow-hidden rounded-[18px] bg-black"
    >
      <div
        className="absolute left-0 top-0"
        style={{
          width: `${PREVIEW_BASE_WIDTH}px`,
          height: `${PREVIEW_BASE_HEIGHT}px`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <OriginalFlyer
          configuration={configuration}
          layers={template.layers ?? []}
          guestName=""
          guestCategory=""
          qrSvg={qrSvg}
          eventDate={null}
          eventTime={null}
          eventLocation={null}
        />
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  variant,
  isBusy,
  isOpening,
  onSelect,
  onDelete,
}: {
  template: FlyerTemplate;
  variant: TemplateGalleryVariant;
  isBusy: boolean;
  isOpening: boolean;
  onSelect: (
    template: FlyerTemplate,
  ) => Promise<void>;
  onDelete?: (
    template: FlyerTemplate,
  ) => void;
}) {
  const isAdmin =
    variant === "admin";

  return (
    <article
      className={[
        getCardWidthClasses(variant),
        "relative flex h-full shrink-0 flex-col",
        "overflow-hidden rounded-3xl",
        "border border-brand-400/15",
        "bg-background p-3 text-left",
        "shadow-lg transition duration-300",
        "hover:-translate-y-1",
        "hover:border-brand-400/40",
        "hover:shadow-[0_24px_60px_rgba(0,0,0,0.16)]",
      ].join(" ")}
    >
      <button
        type="button"
        disabled={isBusy}
        aria-busy={isOpening}
        aria-label={
          isAdmin
            ? `Edit the ${template.title} template`
            : `Use the ${template.title} template`
        }
        onClick={() => {
          void onSelect(template);
        }}
        className="group flex h-full w-full flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:pointer-events-none disabled:opacity-65"
      >
        <TemplateFlyerPreview
          template={template}
        />

        <div className="mt-4 flex h-[88px] w-full flex-col px-2 pb-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-400">
            {getTemplateCategoryLabel(
              template.category,
            )}
          </p>

          <p className="mt-1 line-clamp-1 pr-10 text-sm font-semibold text-foreground">
            {template.title}
          </p>

          <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold text-brand-400">
            {isOpening ? (
              "Opening…"
            ) : isAdmin ? (
              <>
                Edit template
                <PencilLine
                  aria-hidden="true"
                  className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  strokeWidth={2.1}
                />
              </>
            ) : (
              <>
                Use this design
                <ArrowUpRight
                  aria-hidden="true"
                  className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  strokeWidth={2.2}
                />
              </>
            )}
          </span>
        </div>
      </button>

      {isAdmin && onDelete ? (
        <button
          type="button"
          disabled={isBusy}
          aria-label={`Delete the ${template.title} template`}
          onClick={() => {
            onDelete(template);
          }}
          className="absolute right-5 top-5 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white/80 shadow-lg backdrop-blur-md transition hover:border-red-400/40 hover:bg-red-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:pointer-events-none disabled:opacity-50"
        >
          <Trash2
            aria-hidden="true"
            className="h-4 w-4"
            strokeWidth={2}
          />
        </button>
      ) : null}
    </article>
  );
}

export function TemplateGallery({
  variant = "dashboard",
  selectionMode,
  onSelectTemplate,
  onDeleteTemplate,
  maximumTemplates,
  showHeading,
  initialCategory = "all",
  activeCategory:
    controlledActiveCategory,
  onActiveCategoryChange,
  refreshToken = 0,
}: TemplateGalleryProps) {
  const router = useRouter();

  const {
    isAuthenticated,
    isHydrated,
  } = useAuth();

  const { createDraftEvent } =
    useEventContext();

  const resolvedSelectionMode:
    TemplateSelectionMode =
    selectionMode ??
    (variant === "admin"
      ? "callback"
      : "create-event");

  const shouldShowHeading =
    showHeading ??
    variant !== "admin";

  const [
    internalActiveCategory,
    setInternalActiveCategory,
  ] = useState<GalleryCategory>(
    variant === "admin" &&
      initialCategory === "all"
      ? "wedding"
      : initialCategory,
  );

  const activeCategory =
    controlledActiveCategory ??
    internalActiveCategory;

  const visibleCategories = useMemo(
    () =>
      variant === "admin"
        ? TEMPLATE_CATEGORIES
        : [
            ALL_TEMPLATE_CATEGORY,
            ...TEMPLATE_CATEGORIES,
          ],
    [variant],
  );

  const [templates, setTemplates] =
    useState<FlyerTemplate[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [retryToken, setRetryToken] =
    useState(0);

  const [
    openingTemplateId,
    setOpeningTemplateId,
  ] = useState<string | null>(null);

  const activeCategoryData = useMemo(
    () =>
      visibleCategories.find(
        (category) =>
          category.value ===
          activeCategory,
      ) ?? visibleCategories[0],
    [activeCategory, visibleCategories],
  );

  const changeActiveCategory = useCallback(
    (category: GalleryCategory) => {
      if (
        variant === "admin" &&
        category === "all"
      ) {
        return;
      }

      if (
        controlledActiveCategory ===
        undefined
      ) {
        setInternalActiveCategory(
          category,
        );
      }

      if (category !== "all") {
        onActiveCategoryChange?.(
          category,
        );
      }
    },
    [
      controlledActiveCategory,
      onActiveCategoryChange,
      variant,
    ],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadTemplates() {
      setIsLoading(true);
      setError("");

      try {
        const result =
          await fetchFlyerTemplates(
            activeCategory === "all"
              ? {}
              : {
                  category:
                    activeCategory,
                },
          );

        if (cancelled) {
          return;
        }

        const categoryTemplates =
          activeCategory === "all"
            ? result
            : result.filter(
                (template) =>
                  template.category ===
                  activeCategory,
              );

        setTemplates(
          typeof maximumTemplates ===
            "number"
            ? categoryTemplates.slice(
                0,
                maximumTemplates,
              )
            : categoryTemplates,
        );
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        console.error(
          "Unable to load flyer templates",
          caughtError,
        );

        setTemplates([]);
        setError(
          "Templates are temporarily unavailable. Please try again.",
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadTemplates();

    return () => {
      cancelled = true;
    };
  }, [
    activeCategory,
    maximumTemplates,
    refreshToken,
    retryToken,
  ]);

  const handleTemplateSelect = async (
    template: FlyerTemplate,
  ): Promise<void> => {
    if (openingTemplateId) {
      return;
    }

    setOpeningTemplateId(
      template.id,
    );

    setError("");

    try {
      if (
        resolvedSelectionMode ===
        "callback"
      ) {
        if (!onSelectTemplate) {
          throw new Error(
            "Template callback mode requires an onSelectTemplate handler.",
          );
        }

        await onSelectTemplate(template);

        setOpeningTemplateId(null);
        return;
      }

      await onSelectTemplate?.(
        template,
      );

      storePendingTemplate(template);

      const eventId =
        await createDraftEvent(
          `${template.title} Draft`,
          template.event_type,
        );

      const workspacePath =
        `/dashboard/event/${eventId}`;

      if (
        isHydrated &&
        isAuthenticated
      ) {
        router.push(workspacePath);
        return;
      }

      router.push(
        `/login?next=${encodeURIComponent(
          workspacePath,
        )}`,
      );
    } catch (caughtError) {
      console.error(
        "Unable to open flyer template",
        caughtError,
      );

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The template could not be opened.",
      );

      setOpeningTemplateId(null);
    }
  };

  const galleryClassName =
    variant === "landing"
      ? [
          "scrollbar-none mt-8 flex",
          "snap-x snap-mandatory",
          "items-stretch gap-5",
          "overflow-x-auto overscroll-x-contain",
          "pb-7",
        ].join(" ")
      : [
          "mt-6 grid items-stretch gap-5",
          "grid-cols-1",
          "sm:grid-cols-2",
          "lg:grid-cols-3",
          "xl:grid-cols-4",
        ].join(" ");

  const sectionClassName =
    variant === "landing"
      ? "px-4 py-20 sm:px-6 lg:px-8 lg:py-24"
      : variant === "admin"
        ? "mt-6"
        : "mt-12";

  const headingId =
    variant === "landing"
      ? "landing-template-heading"
      : variant === "dashboard"
        ? "dashboard-template-heading"
        : undefined;

  return (
    <section
      className={sectionClassName}
      aria-labelledby={
        shouldShowHeading
          ? headingId
          : undefined
      }
    >
      <div
        className={
          variant === "landing"
            ? [
                "mx-auto max-w-7xl",
                "rounded-[36px]",
                "border border-brand-400/10",
                "bg-brand-400/5",
                "px-4 py-12",
                "shadow-[0_24px_70px_rgba(0,0,0,0.08)]",
                "sm:px-6",
                "lg:px-8 lg:py-16",
              ].join(" ")
            : ""
        }
      >
        {shouldShowHeading &&
        variant === "dashboard" ? (
          <div className="mb-5">
            <h2
              id="dashboard-template-heading"
              className="text-2xl font-semibold"
            >
              Templates
            </h2>

            <p className="mt-2 text-sm text-foreground/55">
              Pick a complete invitation and
              customise it in the workspace.
            </p>
          </div>
        ) : null}

        {shouldShowHeading &&
        variant === "landing" ? (
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-400">
              Templates
            </p>

            <h2
              id="landing-template-heading"
              className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Start with a complete invitation
            </h2>

            <p className="mt-4 text-base leading-7 text-foreground/65">
              Preview the complete flyer and QR
              pass, then open the design in your
              workspace.
            </p>
          </div>
        ) : null}

        <div
          className={
            variant === "landing"
              ? "mt-9"
              : [
                  "sticky top-16 z-40",
                  "-mx-4 border-b",
                  "border-brand-400/10",
                  "bg-background/95 px-4",
                  "backdrop-blur-md",
                  "sm:-mx-6 sm:px-6",
                ].join(" ")
          }
        >
          <div
            className={[
              "scrollbar-none flex gap-2",
              "overflow-x-auto",
              "overscroll-x-contain",
              variant === "landing"
                ? "pb-3"
                : "py-3",
            ].join(" ")}
            role="tablist"
            aria-label="Template categories"
          >
            {visibleCategories.map(
              (category) => {
                const isActive =
                  activeCategory ===
                  category.value;

                return (
                  <button
                    key={category.value}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => {
                      changeActiveCategory(
                        category.value,
                      );
                    }}
                    className={[
                      "whitespace-nowrap rounded-full px-4 py-2",
                      "text-xs font-medium transition",
                      "focus-visible:outline-none",
                      "focus-visible:ring-2",
                      "focus-visible:ring-brand-400",
                      isActive
                        ? "bg-brand-400 text-brand-950"
                        : "bg-brand-400/10 text-foreground/70 hover:bg-brand-400/20 hover:text-foreground",
                    ].join(" ")}
                  >
                    {category.label}
                  </button>
                );
              },
            )}
          </div>
        </div>

        {variant === "landing" ? (
          <div className="mt-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-400">
              {activeCategoryData.eyebrow}
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="mt-8 rounded-2xl border border-red-400/20 bg-red-400/5 px-5 py-8 text-center">
            <p className="text-sm text-red-400">
              {error}
            </p>

            <button
              type="button"
              onClick={() => {
                setRetryToken(
                  (current) =>
                    current + 1,
                );
              }}
              className="mt-4 text-sm font-semibold text-brand-400 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : isLoading ? (
          <div className={galleryClassName}>
            {Array.from({
              length:
                variant === "landing"
                  ? 4
                  : 8,
            }).map((_, index) => (
              <TemplateSkeleton
                key={index}
                variant={variant}
              />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-brand-400/10 bg-background px-5 py-10 text-center">
            <p className="text-sm font-medium">
              No{" "}
              {activeCategoryData.label.toLowerCase()}{" "}
              templates yet
            </p>

            <p className="mt-2 text-sm text-foreground/50">
              New designs will appear here
              automatically when they are
              published.
            </p>
          </div>
        ) : (
          <div className={galleryClassName}>
            {templates.map(
              (template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  variant={variant}
                  isBusy={
                    openingTemplateId !==
                    null
                  }
                  isOpening={
                    openingTemplateId ===
                    template.id
                  }
                  onSelect={
                    handleTemplateSelect
                  }
                  onDelete={
                    onDeleteTemplate
                  }
                />
              ),
            )}
          </div>
        )}
      </div>
    </section>
  );
}
