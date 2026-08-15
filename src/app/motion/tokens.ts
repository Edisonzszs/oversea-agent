import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(Flip, useGSAP);

export const DUR = {
  micro:   0.14,
  fadeOut: 0.12,
  fadeIn:  0.24,
  layout:  0.26,
  enter:   0.28,
} as const;

export const EASE = {
  layout: "power3.inOut",
  enter:  "power2.out",
  exit:   "power2.in",
  micro:  "power2.out",
} as const;

export const SHIFT = {
  small: 6,
  card:  8,
} as const;

export const STAGGER = {
  card: 0.05,
} as const;

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia != null &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export { gsap, Flip, useGSAP };
