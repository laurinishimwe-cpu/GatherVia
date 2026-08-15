import Image from "next/image";
import type { ReactNode } from "react";
import { MobileFrame } from "@/components/workspace/flyer/MobileFrame";

interface FlyerPreviewProps {
  imageSrc: string;
  alt: string;
  fit?: "cover" | "contain";
  priority?: boolean;
  className?: string;
  imageClassName?: string;
  caption?: ReactNode;
  overlay?: ReactNode;
}

export function FlyerPreview({
  imageSrc,
  alt,
  fit = "cover",
  priority = false,
  className = "",
  imageClassName = "",
  caption,
  overlay,
}: FlyerPreviewProps) {
  return (
    <figure className={`flex w-full flex-col items-center gap-4 ${className}`}>
      <MobileFrame>
        <div className="relative h-full w-full bg-black">
          <Image
            src={imageSrc}
            alt={alt}
            fill
            priority={priority}
            sizes="340px"
            className={`${fit === "cover" ? "object-cover" : "object-contain"} ${imageClassName}`}
          />
          {overlay ? <div className="absolute inset-0 z-30">{overlay}</div> : null}
        </div>
      </MobileFrame>
      {caption ? <figcaption className="max-w-sm text-center text-sm text-foreground/60">{caption}</figcaption> : null}
    </figure>
  );
}
