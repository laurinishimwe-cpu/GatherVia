interface AvatarPlaceholderProps {
  className?: string;
}

export function AvatarPlaceholder({ className = "" }: AvatarPlaceholderProps) {
  return (
    <div className={`flex h-9 w-9 items-center justify-center rounded-full border border-brand-400/20 bg-brand-400/5 text-foreground/50 ${className}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2" />
      </svg>
    </div>
  );
}
