
export function CreateCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-60 h-40 rounded-3xl border-2 border-dashed border-brand-400/30 bg-brand-400/5 flex flex-col items-center justify-center gap-2 hover:border-brand-400/60 hover:bg-brand-400/10 transition group"
    >
      <span className="text-3xl font-light text-brand-400 group-hover:scale-110 transition">+</span>
      <span className="text-sm font-medium text-foreground/70">Create new event</span>
    </button>
  );
}
