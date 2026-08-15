"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Fuse from "fuse.js";
import { loadFlyerFont } from "@/lib/flyer/fontLoader";
import {
  BUNDLED_FONT_FAMILIES,
  BUNDLED_FONT_FAMILY_NAMES,
} from "@/lib/flyer/fontRegistry";

type FontCategory =
  | "system"
  | "sans-serif"
  | "serif"
  | "display"
  | "handwriting"
  | "monospace";

type FontSource = "system" | "google" | "bundled";
type FontFilter = "all" | "recommended" | FontCategory;

interface FontOption {
  family: string;
  label: string;
  category: FontCategory;
  source: FontSource;
  tags: string[];
  recommended: boolean;
}

const SYSTEM_FONTS: FontOption[] = [
  { family: "system-ui", label: "System UI", category: "system", source: "system", tags: ["native", "fast", "interface"], recommended: true },
  { family: "Arial", label: "Arial", category: "system", source: "system", tags: ["classic", "safe", "body"], recommended: false },
  { family: "Helvetica", label: "Helvetica", category: "system", source: "system", tags: ["clean", "classic", "branding"], recommended: false },
  { family: "Segoe UI", label: "Segoe UI", category: "system", source: "system", tags: ["windows", "interface", "clean"], recommended: false },
  { family: "Verdana", label: "Verdana", category: "system", source: "system", tags: ["readable", "screen", "body"], recommended: false },
  { family: "Tahoma", label: "Tahoma", category: "system", source: "system", tags: ["compact", "screen", "body"], recommended: false },
  { family: "Trebuchet MS", label: "Trebuchet MS", category: "system", source: "system", tags: ["friendly", "screen", "body"], recommended: false },
  { family: "Gill Sans", label: "Gill Sans", category: "system", source: "system", tags: ["humanist", "editorial", "clean"], recommended: false },
  { family: "Avenir", label: "Avenir", category: "system", source: "system", tags: ["geometric", "modern", "clean"], recommended: false },
  { family: "Century Gothic", label: "Century Gothic", category: "system", source: "system", tags: ["geometric", "modern", "title"], recommended: false },
  { family: "Franklin Gothic Medium", label: "Franklin Gothic", category: "system", source: "system", tags: ["strong", "headline", "editorial"], recommended: false },
  { family: "Impact", label: "Impact", category: "system", source: "system", tags: ["bold", "poster", "headline"], recommended: false },
  { family: "Georgia", label: "Georgia", category: "system", source: "system", tags: ["editorial", "readable", "serif"], recommended: true },
  { family: "Times New Roman", label: "Times New Roman", category: "system", source: "system", tags: ["classic", "formal", "serif"], recommended: false },
  { family: "Baskerville", label: "Baskerville", category: "system", source: "system", tags: ["elegant", "formal", "serif"], recommended: false },
  { family: "Garamond", label: "Garamond", category: "system", source: "system", tags: ["book", "classic", "serif"], recommended: false },
  { family: "Palatino Linotype", label: "Palatino", category: "system", source: "system", tags: ["book", "readable", "serif"], recommended: false },
  { family: "Courier New", label: "Courier New", category: "system", source: "system", tags: ["typewriter", "mono", "retro"], recommended: false },
  { family: "Consolas", label: "Consolas", category: "system", source: "system", tags: ["code", "mono", "technical"], recommended: false },
  { family: "Monaco", label: "Monaco", category: "system", source: "system", tags: ["code", "mono", "technical"], recommended: false },
  { family: "Comic Sans MS", label: "Comic Sans MS", category: "system", source: "system", tags: ["casual", "playful", "informal"], recommended: false },
];

const GOOGLE_FONT_GROUPS: Record<Exclude<FontCategory, "system">, readonly string[]> = {
  "sans-serif": [
    "ABeeZee",
    "Albert Sans",
    "Alegreya Sans",
    "Archivo",
    "Archivo Black",
    "Archivo Narrow",
    "Arimo",
    "Asap",
    "Asap Condensed",
    "Assistant",
    "Atkinson Hyperlegible",
    "Barlow",
    "Barlow Condensed",
    "Barlow Semi Condensed",
    "Be Vietnam Pro",
    "Cabin",
    "Cabin Condensed",
    "Cairo",
    "Catamaran",
    "Chivo",
    "Comfortaa",
    "Commissioner",
    "DM Sans",
    "Dosis",
    "Encode Sans",
    "Encode Sans Condensed",
    "Epilogue",
    "Exo",
    "Exo 2",
    "Figtree",
    "Geologica",
    "Georama",
    "Hanken Grotesk",
    "Heebo",
    "Hind",
    "IBM Plex Sans",
    "Inter",
    "Jost",
    "Kanit",
    "Karla",
    "Kumbh Sans",
    "Lato",
    "League Spartan",
    "Lexend",
    "Lexend Deca",
    "Libre Franklin",
    "Manrope",
    "Maven Pro",
    "M PLUS 1p",
    "M PLUS Rounded 1c",
    "Montserrat",
    "Montserrat Alternates",
    "Mukta",
    "Mulish",
    "Nanum Gothic",
    "Noto Sans",
    "Noto Sans Display",
    "Nunito",
    "Nunito Sans",
    "Open Sans",
    "Orbitron",
    "Oswald",
    "Outfit",
    "Overpass",
    "Oxanium",
    "Oxygen",
    "Plus Jakarta Sans",
    "Poppins",
    "Prompt",
    "PT Sans",
    "PT Sans Caption",
    "PT Sans Narrow",
    "Public Sans",
    "Questrial",
    "Quicksand",
    "Rajdhani",
    "Raleway",
    "Red Hat Display",
    "Red Hat Text",
    "Roboto",
    "Roboto Condensed",
    "Roboto Flex",
    "Rubik",
    "Saira",
    "Saira Condensed",
    "Signika",
    "Sora",
    "Source Sans 3",
    "Space Grotesk",
    "Titillium Web",
    "Ubuntu",
    "Urbanist",
    "Varela Round",
    "Work Sans",
    "Yantramanav",
  ],
  serif: [
    "Alegreya",
    "Alike",
    "Alike Angular",
    "Almendra",
    "Amiri",
    "Arvo",
    "Bitter",
    "Bodoni Moda",
    "Bree Serif",
    "Brygada 1918",
    "Cardo",
    "Cormorant",
    "Cormorant Garamond",
    "Cormorant Infant",
    "Cormorant SC",
    "Crimson Pro",
    "Crimson Text",
    "DM Serif Display",
    "DM Serif Text",
    "Domine",
    "EB Garamond",
    "Faustina",
    "Frank Ruhl Libre",
    "Fraunces",
    "Gelasio",
    "Gentium Book Plus",
    "Gloock",
    "IBM Plex Serif",
    "Inknut Antiqua",
    "Instrument Serif",
    "Josefin Slab",
    "Judson",
    "Libre Baskerville",
    "Literata",
    "Lora",
    "Lustria",
    "Marcellus",
    "Merriweather",
    "Neuton",
    "Newsreader",
    "Noto Serif",
    "Noto Serif Display",
    "Old Standard TT",
    "Petrona",
    "Playfair Display",
    "Prata",
    "PT Serif",
    "Roboto Serif",
    "Roboto Slab",
    "Rokkitt",
    "Rozha One",
    "Rufina",
    "Slabo 27px",
    "Source Serif 4",
    "Spectral",
    "Tinos",
    "Trirong",
    "Vidaloka",
    "Vollkorn",
    "Young Serif",
    "Yeseva One",
    "Zilla Slab",
  ],
  display: [
    "Abril Fatface",
    "Aclonica",
    "Alfa Slab One",
    "Anton",
    "Audiowide",
    "Bebas Neue",
    "Berkshire Swash",
    "Big Shoulders Display",
    "Black Han Sans",
    "Black Ops One",
    "Bowlby One",
    "Bowlby One SC",
    "Bungee",
    "Bungee Shade",
    "Carter One",
    "Cinzel",
    "Cinzel Decorative",
    "Concert One",
    "Contrail One",
    "Days One",
    "Economica",
    "Erica One",
    "Fascinate",
    "Faster One",
    "Forum",
    "Fredoka",
    "Fredericka the Great",
    "Fugaz One",
    "Graduate",
    "Grandstander",
    "Gravitas One",
    "Holtwood One SC",
    "Jockey One",
    "Josefin Sans",
    "Khand",
    "Krona One",
    "Kumar One",
    "League Gothic",
    "Lilita One",
    "Limelight",
    "Londrina Solid",
    "Major Mono Display",
    "Michroma",
    "Modak",
    "Monoton",
    "MuseoModerno",
    "Notable",
    "Patua One",
    "Poiret One",
    "Press Start 2P",
    "Racing Sans One",
    "Rampart One",
    "Rammetto One",
    "Ranchers",
    "Righteous",
    "Rowdies",
    "Rubik Mono One",
    "Russo One",
    "Secular One",
    "Sigmar",
    "Silkscreen",
    "Special Elite",
    "Staatliches",
    "Syncopate",
    "Teko",
    "Tilt Neon",
    "Titan One",
    "Trade Winds",
    "Trochut",
    "Ultra",
    "Unbounded",
    "Wallpoet",
  ],
  handwriting: [
    "Alex Brush",
    "Allura",
    "Amatic SC",
    "Architects Daughter",
    "Bad Script",
    "Bilbo Swash Caps",
    "Bonbon",
    "Calligraffitti",
    "Caveat",
    "Cedarville Cursive",
    "Courgette",
    "Covered By Your Grace",
    "Crafty Girls",
    "Damion",
    "Dancing Script",
    "Dawning of a New Day",
    "Gloria Hallelujah",
    "Gochi Hand",
    "Grand Hotel",
    "Great Vibes",
    "Homemade Apple",
    "Indie Flower",
    "Italianno",
    "Just Another Hand",
    "Kalam",
    "Kaushan Script",
    "La Belle Aurore",
    "Leckerli One",
    "Lobster",
    "Lobster Two",
    "Love Ya Like A Sister",
    "Marck Script",
    "Merienda",
    "Monsieur La Doulaise",
    "Mr Dafoe",
    "Mrs Saint Delafield",
    "Neucha",
    "Nothing You Could Do",
    "Pacifico",
    "Parisienne",
    "Permanent Marker",
    "Petit Formal Script",
    "Playball",
    "Qwigley",
    "Rancho",
    "Reenie Beanie",
    "Rochester",
    "Rock Salt",
    "Rouge Script",
    "Sacramento",
    "Satisfy",
    "Shadows Into Light",
    "Short Stack",
    "Sofia",
    "Sue Ellen Francisco",
    "Tangerine",
    "The Girl Next Door",
    "Yellowtail",
    "Zeyada",
  ],
  monospace: [
    "Anonymous Pro",
    "Azeret Mono",
    "B612 Mono",
    "Courier Prime",
    "Cousine",
    "Cutive Mono",
    "DM Mono",
    "Fira Code",
    "Fira Mono",
    "Fragment Mono",
    "IBM Plex Mono",
    "Inconsolata",
    "JetBrains Mono",
    "Martian Mono",
    "Noto Sans Mono",
    "Overpass Mono",
    "PT Mono",
    "Red Hat Mono",
    "Roboto Mono",
    "Share Tech Mono",
    "Source Code Pro",
    "Space Mono",
    "Syne Mono",
    "Ubuntu Mono",
    "Victor Mono",
  ],
};

const RECOMMENDED_FONT_FAMILIES = new Set([
  "system-ui",
  "Georgia",
  "Inter",
  "Manrope",
  "DM Sans",
  "Montserrat",
  "Poppins",
  "Figtree",
  "Plus Jakarta Sans",
  "Outfit",
  "Space Grotesk",
  "Raleway",
  "Playfair Display",
  "Cormorant Garamond",
  "DM Serif Display",
  "Lora",
  "Merriweather",
  "Fraunces",
  "Bebas Neue",
  "Anton",
  "Oswald",
  "Cinzel",
  "Fredoka",
  "Unbounded",
  "Dancing Script",
  "Great Vibes",
  "Caveat",
  "Pacifico",
  "Roboto Mono",
  "JetBrains Mono",
]);

const SPECIAL_TAGS: Record<string, string[]> = {
  Inter: ["clean", "modern", "ui", "minimal", "body"],
  Manrope: ["modern", "premium", "clean", "invitation"],
  "DM Sans": ["friendly", "modern", "clean", "body"],
  Montserrat: ["geometric", "bold", "event", "headline"],
  Poppins: ["rounded", "modern", "friendly", "event"],
  Figtree: ["clean", "contemporary", "ui", "body"],
  "Plus Jakarta Sans": ["premium", "clean", "modern", "body"],
  Outfit: ["geometric", "modern", "headline", "event"],
  "Space Grotesk": ["editorial", "modern", "tech", "headline"],
  Raleway: ["elegant", "fashion", "wedding", "title"],
  "Playfair Display": ["luxury", "editorial", "wedding", "title"],
  "Cormorant Garamond": ["luxury", "romantic", "wedding", "formal"],
  "DM Serif Display": ["editorial", "luxury", "poster", "title"],
  Lora: ["readable", "warm", "editorial", "body"],
  Merriweather: ["readable", "formal", "body", "editorial"],
  Fraunces: ["expressive", "editorial", "luxury", "title"],
  "Bebas Neue": ["bold", "poster", "sports", "headline"],
  Anton: ["impact", "poster", "headline", "bold"],
  Oswald: ["condensed", "poster", "event", "headline"],
  Cinzel: ["ceremonial", "luxury", "formal", "wedding"],
  Fredoka: ["playful", "birthday", "children", "friendly"],
  Unbounded: ["futuristic", "creative", "poster", "headline"],
  "Dancing Script": ["romantic", "wedding", "signature", "invitation"],
  "Great Vibes": ["elegant", "wedding", "calligraphy", "luxury"],
  Caveat: ["casual", "handwritten", "friendly", "note"],
  Pacifico: ["retro", "friendly", "summer", "casual"],
  "Roboto Mono": ["technical", "code", "ticket", "details"],
  "JetBrains Mono": ["technical", "code", "ticket", "details"],
};

const CATEGORY_TAGS: Record<FontCategory, string[]> = {
  system: ["system", "local", "fast"],
  "sans-serif": ["sans", "clean", "modern"],
  serif: ["serif", "classic", "editorial"],
  display: ["display", "headline", "poster"],
  handwriting: ["script", "handwritten", "invitation"],
  monospace: ["mono", "technical", "code"],
};

const CATEGORY_LABELS: Record<FontCategory, string> = {
  system: "System",
  "sans-serif": "Sans",
  serif: "Serif",
  display: "Display",
  handwriting: "Script",
  monospace: "Mono",
};

const CATEGORY_FALLBACKS: Record<FontCategory, string> = {
  system: "system-ui, sans-serif",
  "sans-serif": "Arial, sans-serif",
  serif: "Georgia, serif",
  display: "Impact, sans-serif",
  handwriting: "cursive",
  monospace: "Consolas, monospace",
};

const GOOGLE_FONTS: FontOption[] = (
  Object.entries(GOOGLE_FONT_GROUPS) as [
    Exclude<FontCategory, "system">,
    readonly string[],
  ][]
).flatMap(([category, families]) =>
  families.map((family) => ({
    family,
    label: family,
    category,
    source: "google" as const,
    tags: Array.from(
      new Set([
        ...CATEGORY_TAGS[category],
        ...(SPECIAL_TAGS[family] ?? []),
      ]),
    ),
    recommended: RECOMMENDED_FONT_FAMILIES.has(family),
  })),
);

const BUNDLED_FONT_NAMES = new Set(
  BUNDLED_FONT_FAMILY_NAMES.map((family) => family.toLowerCase()),
);

const BUNDLED_FONT_CATEGORIES = new Map(
  BUNDLED_FONT_FAMILIES.map(({ family, category }) => [
    family.toLowerCase(),
    category === "sans" ? "sans-serif" : category,
  ] as const),
);

const EXTENDED_FONTS: FontOption[] = Array.from(
  new Map(
    [...SYSTEM_FONTS, ...GOOGLE_FONTS].map((font) => [
      font.family.toLowerCase(),
      font,
    ]),
).values(),
).filter((font) => BUNDLED_FONT_NAMES.has(font.family.toLowerCase())).map(
  (font) => ({
    ...font,
    category: BUNDLED_FONT_CATEGORIES.get(font.family.toLowerCase()) ?? font.category,
    source: "bundled" as const,
    recommended: true,
  }),
).sort((a, b) => {
  if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
  return a.label.localeCompare(b.label);
});

const FONT_BY_FAMILY = new Map(
  EXTENDED_FONTS.map((font) => [font.family.toLowerCase(), font]),
);

const FONT_STYLES = [
  { value: "normal-normal", label: "Regular", previewWeight: 400, previewStyle: "normal" },
  { value: "normal-italic", label: "Italic", previewWeight: 400, previewStyle: "italic" },
  { value: "medium-normal", label: "Medium", previewWeight: 400, previewStyle: "normal" },
  { value: "medium-italic", label: "Medium Italic", previewWeight: 400, previewStyle: "italic" },
  { value: "semibold-normal", label: "Semibold", previewWeight: 700, previewStyle: "normal" },
  { value: "semibold-italic", label: "Semibold Italic", previewWeight: 700, previewStyle: "italic" },
  { value: "bold-normal", label: "Bold", previewWeight: 700, previewStyle: "normal" },
  { value: "bold-italic", label: "Bold Italic", previewWeight: 700, previewStyle: "italic" },
] as const;

const FONT_FILTERS: { value: FontFilter; label: string }[] = [
  { value: "recommended", label: "Suggested" },
  { value: "all", label: "All" },
  { value: "sans-serif", label: "Sans" },
  { value: "serif", label: "Serif" },
  { value: "display", label: "Display" },
  { value: "handwriting", label: "Script" },
];

function getFontStack(font: FontOption | undefined, fallbackFamily: string): string {
  if (!font) return `"${fallbackFamily}", system-ui, sans-serif`;

  const quotedFamily = /^[a-z-]+$/i.test(font.family)
    ? font.family
    : `"${font.family.replace(/"/g, '\\"')}"`;

  return `${quotedFamily}, ${CATEGORY_FALLBACKS[font.category]}`;
}

function getPreviewWeight(weight: string): number {
  switch (weight) {
    case "medium":
      return 500;
    case "semibold":
      return 600;
    case "bold":
      return 700;
    default:
      return 400;
  }
}

interface FontPickerProps {
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  onChangeFamily: (family: string) => void;
  onChangeStyle: (weight: string, style: string) => void;
}

export function FontPicker({
  fontFamily,
  fontWeight,
  fontStyle,
  onChangeFamily,
  onChangeStyle,
}: FontPickerProps) {
  const [isFamilyOpen, setIsFamilyOpen] = useState(false);
  const [isStyleOpen, setIsStyleOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] =
    useState<FontFilter>("recommended");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const familyTriggerRef = useRef<HTMLButtonElement>(null);
  const styleTriggerRef = useRef<HTMLButtonElement>(null);
  const familyPopoverRef = useRef<HTMLDivElement>(null);
  const stylePopoverRef = useRef<HTMLDivElement>(null);

  const [familyPopoverPos, setFamilyPopoverPos] = useState({ top: 0, left: 0 });
  const [stylePopoverPos, setStylePopoverPos] = useState({ top: 0, left: 0 });

  const fuse = useMemo(
    () =>
      new Fuse(EXTENDED_FONTS, {
        keys: [
          { name: "label", weight: 0.55 },
          { name: "family", weight: 0.2 },
          { name: "tags", weight: 0.2 },
          { name: "category", weight: 0.05 },
        ],
        threshold: 0.32,
        ignoreLocation: true,
      }),
    [],
  );

  const filteredFonts = useMemo(() => {
    const normalizedSearch = search.trim();
    const candidates = normalizedSearch
      ? fuse.search(normalizedSearch).map((result) => result.item)
      : EXTENDED_FONTS;

    return candidates.filter((font) => {
      if (activeFilter === "all") return true;
      if (activeFilter === "recommended") return font.recommended;
      return font.category === activeFilter;
    });
  }, [activeFilter, fuse, search]);

  const selectedFont = FONT_BY_FAMILY.get((fontFamily || "Inter").toLowerCase());
  const combinedStyle = `${fontWeight ?? "normal"}-${fontStyle ?? "normal"}`;
  const currentStyleLabel =
    FONT_STYLES.find((style) => style.value === combinedStyle)?.label ??
    "Regular";

  const updateFamilyPopoverPosition = useCallback(() => {
    const trigger = familyTriggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const width = 300;
    const estimatedHeight = 390;
    const margin = 12;
    const gap = 6;

    let left = rect.right - width;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));

    let top = rect.bottom + gap;
    if (top + estimatedHeight > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - estimatedHeight - gap);
    }

    setFamilyPopoverPos((current) =>
      current.top === top && current.left === left ? current : { top, left },
    );
  }, []);

  const updateStylePopoverPosition = useCallback(() => {
    const trigger = styleTriggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const width = 160;
    const estimatedHeight = 250;
    const margin = 12;
    const gap = 6;

    let left = rect.right - width;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));

    let top = rect.bottom + gap;
    if (top + estimatedHeight > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - estimatedHeight - gap);
    }

    setStylePopoverPos((current) =>
      current.top === top && current.left === left ? current : { top, left },
    );
  }, []);

  useEffect(() => {
    if (!isFamilyOpen) return;

    updateFamilyPopoverPosition();
    window.addEventListener("resize", updateFamilyPopoverPosition);
    window.addEventListener("scroll", updateFamilyPopoverPosition, true);

    return () => {
      window.removeEventListener("resize", updateFamilyPopoverPosition);
      window.removeEventListener("scroll", updateFamilyPopoverPosition, true);
    };
  }, [isFamilyOpen, updateFamilyPopoverPosition]);

  useEffect(() => {
    if (!isStyleOpen) return;

    updateStylePopoverPosition();
    window.addEventListener("resize", updateStylePopoverPosition);
    window.addEventListener("scroll", updateStylePopoverPosition, true);

    return () => {
      window.removeEventListener("resize", updateStylePopoverPosition);
      window.removeEventListener("scroll", updateStylePopoverPosition, true);
    };
  }, [isStyleOpen, updateStylePopoverPosition]);

  useEffect(() => {
    loadFlyerFont(fontFamily || "Inter", fontWeight, fontStyle);
  }, [fontFamily, fontStyle, fontWeight]);

  // Close any open dropdown when clicking outside the trigger or portal.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const clickedTrigger = dropdownRef.current?.contains(target);
      const clickedFamilyPopover = familyPopoverRef.current?.contains(target);
      const clickedStylePopover = stylePopoverRef.current?.contains(target);

      if (!clickedTrigger && !clickedFamilyPopover && !clickedStylePopover) {
        setIsFamilyOpen(false);
        setIsStyleOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const chooseFont = (font: FontOption) => {
    loadFlyerFont(font.family, fontWeight, fontStyle);
    onChangeFamily(font.family);
    setSearch("");
    setIsFamilyOpen(false);
  };

  return (
    <div className="relative flex flex-col gap-2" ref={dropdownRef}>
      <div className="flex gap-2">
        <button
          ref={familyTriggerRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isFamilyOpen}
          onClick={() => {
            setIsFamilyOpen((open) => !open);
            setIsStyleOpen(false);
          }}
          className="flex min-w-0 flex-1 items-center justify-between rounded-lg border border-brand-400/20 bg-background px-2 py-1.5 text-left text-xs outline-none transition-colors hover:border-brand-400/50"
        >
          <span
            className="truncate"
            style={{
              fontFamily: getFontStack(selectedFont, fontFamily || "Inter"),
              fontWeight: getPreviewWeight(fontWeight),
              fontStyle: fontStyle === "italic" ? "italic" : "normal",
            }}
          >
            {fontFamily || "Inter"}
          </span>
          <svg
            className="ml-2 h-3 w-3 shrink-0 text-foreground/50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        <button
          ref={styleTriggerRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isStyleOpen}
          onClick={() => {
            setIsStyleOpen((open) => !open);
            setIsFamilyOpen(false);
          }}
          className="flex w-[110px] items-center justify-between rounded-lg border border-brand-400/20 bg-background px-2 py-1.5 text-left text-xs outline-none transition-colors hover:border-brand-400/50"
        >
          <span className="truncate">{currentStyleLabel}</span>
          <svg
            className="h-3 w-3 shrink-0 text-foreground/50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      {/* Font family popover — rendered at document.body to escape workspace clipping */}
      {isFamilyOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={familyPopoverRef}
            style={{
              top: familyPopoverPos.top,
              left: familyPopoverPos.left,
              zIndex: 99999,
            }}
            className="fixed flex max-h-[390px] w-[300px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-xl border border-brand-400/20 bg-background shadow-2xl"
          >
          <div className="space-y-2 border-b border-brand-400/10 p-2">
            <div className="relative">
              <svg
                className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search: wedding, modern, bold..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-md border-none bg-brand-400/5 py-1.5 pl-7 pr-2 text-xs outline-none focus:ring-1 focus:ring-brand-400/50"
                autoFocus
              />
            </div>

            <div className="scrollbar-custom flex gap-1 overflow-x-auto pb-0.5">
              {FONT_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setActiveFilter(filter.value)}
                  className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-medium transition ${
                    activeFilter === filter.value
                      ? "bg-brand-400 text-black"
                      : "bg-brand-400/10 text-foreground/65 hover:bg-brand-400/20 hover:text-foreground"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between px-0.5 text-[9px] text-foreground/45">
              <span>{filteredFonts.length} fonts</span>
              <span>Bundled on web and mobile</span>
            </div>
          </div>

          <div
            role="listbox"
            aria-label="Font families"
            className="scrollbar-custom overflow-y-auto p-1"
          >
            {filteredFonts.length > 0 ? (
              filteredFonts.map((font) => (
                <button
                  key={`${font.source}-${font.family}`}
                  type="button"
                  role="option"
                  aria-selected={fontFamily === font.family}
                  onMouseEnter={() => loadFlyerFont(font.family)}
                  onFocus={() => loadFlyerFont(font.family)}
                  onClick={() => chooseFont(font)}
                  className={`group flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors ${
                    fontFamily === font.family
                      ? "bg-brand-400/20 text-brand-400"
                      : "hover:bg-brand-400/10"
                  }`}
                >
                  <span
                    className="flex h-7 w-8 shrink-0 items-center justify-center rounded border border-brand-400/10 bg-brand-400/5 text-sm"
                    style={{ fontFamily: getFontStack(font, font.family) }}
                  >
                    Aa
                  </span>

                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-xs"
                      style={{ fontFamily: getFontStack(font, font.family) }}
                    >
                      {font.label}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-[9px] text-foreground/40">
                      <span>{CATEGORY_LABELS[font.category]}</span>
                      <span>·</span>
                      <span>Bundled</span>
                    </span>
                  </span>

                  {font.recommended && (
                    <span
                      className="shrink-0 rounded-full bg-brand-400/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-brand-400"
                      title="Recommended for common flyer designs"
                    >
                      Pick
                    </span>
                  )}
                </button>
              ))
            ) : (
              <div className="px-3 py-6 text-center text-xs text-foreground/50">
                No matching fonts
              </div>
            )}
          </div>
          </div>,
          document.body,
        )}

      {/* Font style popover — rendered at document.body to escape workspace clipping */}
      {isStyleOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={stylePopoverRef}
            style={{
              top: stylePopoverPos.top,
              left: stylePopoverPos.left,
              zIndex: 99999,
            }}
            className="fixed flex max-h-[250px] w-[160px] flex-col overflow-hidden rounded-xl border border-brand-400/20 bg-background shadow-2xl"
          >
          <div className="p-1">
            {FONT_STYLES.map((style) => (
              <button
                key={style.value}
                type="button"
                onClick={() => {
                  const [weight, fontStyleValue] = style.value.split("-");
                  onChangeStyle(weight, fontStyleValue);
                  setIsStyleOpen(false);
                }}
                className={`w-full rounded-md px-3 py-1.5 text-left text-xs transition-colors ${
                  combinedStyle === style.value
                    ? "bg-brand-400/20 text-brand-400"
                    : "hover:bg-brand-400/10"
                }`}
                style={{
                  fontFamily: getFontStack(selectedFont, fontFamily || "Inter"),
                  fontWeight: style.previewWeight,
                  fontStyle: style.previewStyle,
                }}
              >
                {style.label}
              </button>
            ))}
          </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
