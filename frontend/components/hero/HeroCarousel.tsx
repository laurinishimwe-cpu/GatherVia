"use client";

import Image from "next/image";

interface HeroImage {
  src: string;
  alt: string;
}

interface HeroCarouselProps {
  images: HeroImage[];
  interval?: number;
  className?: string;
}

export default function HeroCarousel({
  images,
  interval = 5,
  className = "",
}: HeroCarouselProps) {
  if (!images.length) return null;

  const n = images.length;
  const totalDuration = n * interval;

  const pFadeIn = 100 / (n * 4);         
  const pVisible = 100 / n;              
  const pFadeOut = (100 / n) * 1.35;     

  const animationName = `dynamicHeroFade-${n}`;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <style>{`
        @keyframes ${animationName} {
          0% {
            opacity: 0;
            transform: scale(1.04);
          }
          ${pFadeIn}% {
            opacity: 1;
          }
          ${pVisible}% {
            opacity: 1;
          }
          ${pFadeOut}% {
            opacity: 0;
            transform: scale(1.12);
          }
          100% {
            opacity: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-carousel-slide {
            animation: none !important;
            opacity: 0 !important;
            transform: none !important;
          }

          .hero-carousel-slide[data-first-slide="true"] {
            opacity: 1 !important;
          }
        }
      `}</style>

      {images.map((image, index) => (
        <div
          key={image.src}
          className="hero-carousel-slide absolute inset-0"
          data-first-slide={index === 0 ? "true" : undefined}
          style={{
            animationName: animationName,
            animationDuration: `${totalDuration}s`,
            animationDelay: `${index * interval}s`,
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-in-out",
            opacity: 0,
          }}
        >
          <Image
            src={image.src}
            alt={image.alt}
            fill
            className="object-cover"
            priority={index === 0}
            sizes="100vw"
          />
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/20 to-cyan-900/60 dark:from-black/40 dark:to-black/80" />
    </div>
  );
}
