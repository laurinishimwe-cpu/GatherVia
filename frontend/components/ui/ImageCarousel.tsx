"use client";

import { useState, useEffect, useCallback, ReactNode } from "react";

function ChevronLeftIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

interface Slide {
  id: string;
  content: ReactNode;
}

interface ImageCarouselProps {
  slides: Slide[];
  autoPlayInterval?: number;
  className?: string;
}

export default function ImageCarousel({
  slides,
  autoPlayInterval = 4000,
  className = "",
}: ImageCarouselProps) {

  const [current, setCurrent] = useState(1);
  const [hasTransition, setHasTransition] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  const extendedSlides = slides.length > 0 ? [
    { ...slides[slides.length - 1], id: `clone-last-${slides[slides.length - 1].id}` },
    ...slides,
    { ...slides[0], id: `clone-first-${slides[0].id}` },
  ] : [];

  const goTo = useCallback((index: number) => {
    setHasTransition(true);
    setCurrent(index);
  }, []);

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  useEffect(() => {
    if (!autoPlayInterval || isPaused) return;
    const id = setInterval(next, autoPlayInterval);
    return () => clearInterval(id);
  }, [autoPlayInterval, isPaused, next]);

  const handleTransitionEnd = () => {
    if (current === extendedSlides.length - 1) {

      setHasTransition(false);
      setCurrent(1);
    } else if (current === 0) {

      setHasTransition(false);
      setCurrent(extendedSlides.length - 2);
    }
  };

  const pause = () => setIsPaused(true);
  const resume = () => setIsPaused(false);

  if (!slides.length) return null;

  const activeDotIndex =
    current === 0
      ? slides.length - 1
      : current === extendedSlides.length - 1
      ? 0
      : current - 1;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onMouseEnter={pause}
      onMouseLeave={resume}
    >
      {/* Slides Track */}
      <div
        className="flex ease-out"
        onTransitionEnd={handleTransitionEnd}
        style={{
          transform: `translateX(-${current * 100}%)`,
          transitionDuration: hasTransition ? "500ms" : "0ms",
        }}
      >
        {extendedSlides.map((slide) => (
          <div key={slide.id} className="w-full flex-shrink-0">
            {slide.content}
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 text-foreground shadow backdrop-blur hover:bg-background transition"
            aria-label="Previous slide"
          >
            <ChevronLeftIcon />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 text-foreground shadow backdrop-blur hover:bg-background transition"
            aria-label="Next slide"
          >
            <ChevronRightIcon />
          </button>
        </>
      )}

      {slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goTo(index + 1)} 
              className={`h-2 w-2 rounded-full transition-all ${
                index === activeDotIndex
                  ? "bg-brand-400 w-5"
                  : "bg-foreground/40 hover:bg-foreground/60"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
