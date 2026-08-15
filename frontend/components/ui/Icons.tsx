import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function BaseIcon({ className, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export function SparklesIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 2l1.9 4.9L19 8.8l-5 2.1L12 16l-2-5.1-5-2.1 5.1-1.9L12 2Z" />
      <path d="M5 14l1.1 2.9L9 18l-2.9 1.1L5 22l-1.1-2.9L1 18l2.9-1.1L5 14Z" />
      <path d="M19 13l.8 2.2L22 16l-2.2.8L19 19l-.8-2.2L16 16l2.2-.8L19 13Z" />
    </BaseIcon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3l7 3v5c0 4.2-2.6 7.8-7 10-4.4-2.2-7-5.8-7-10V6l7-3Z" />
      <path d="M9 12l2 2 4-5" />
    </BaseIcon>
  );
}

export function QrIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" />
      <path d="M16 14h1.5M16 17h4M19 14v6M14 19h2.5" />
    </BaseIcon>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M16.5 20c0-2.5-1.9-4.5-4.5-4.5S7.5 17.5 7.5 20" />
      <path d="M12 12.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M18.5 20c0-1.8-1-3.4-2.4-4.1" />
      <path d="M16.5 7.8a3 3 0 0 1 0 5.4" />
    </BaseIcon>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m12 3 8 4-8 4-8-4 8-4Z" />
      <path d="m4 11 8 4 8-4" />
      <path d="m4 16 8 4 8-4" />
    </BaseIcon>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 19h16" />
      <path d="M7 16v-4" />
      <path d="M12 16V8" />
      <path d="M17 16v-7" />
    </BaseIcon>
  );
}

export function PaletteIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3a9 9 0 1 0 0 18h2.5a1.5 1.5 0 0 0 0-3H13a1 1 0 0 1-1-1v-.2a1.8 1.8 0 0 1 1.8-1.8H15a5 5 0 0 0 5-5c0-4.4-3.6-7-8-7Z" />
      <path d="M8.5 9.5h.01" />
      <path d="M6.5 13h.01" />
      <path d="M15 8.5h.01" />
      <path d="M17.5 12h.01" />
    </BaseIcon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </BaseIcon>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M7 3v3" />
      <path d="M17 3v3" />
      <path d="M4 8h16" />
      <rect x="4" y="5" width="16" height="16" rx="3" />
      <path d="M8 12h4" />
      <path d="M8 16h6" />
    </BaseIcon>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M6 4v16" />
      <path d="M18 4v16" />
      <path d="M6 9h12" />
      <path d="M6 15h12" />
      <circle cx="9" cy="9" r="2" />
      <circle cx="15" cy="15" r="2" />
    </BaseIcon>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 20h4l10-10a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5 4 20Z" />
      <path d="M13.5 6.5 17 10" />
    </BaseIcon>
  );
}

export function BackArrow() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}
