"use client";

import { ZoomIn, ZoomOut } from "lucide-react";
import { brand } from "@/lib/brand-colors";
import { ZOOM_MAX, ZOOM_MIN } from "@/lib/dashboard/photo-crop";
import { CONTENT_FOCUS } from "./content-parts";

/**
 * A crop dialog's zoom (board 93f): the filled part of the track is the
 * accent, the knob paper, between a zoom-out and a zoom-in glass. The photo
 * and the background crop dialogs both draw this one, so no browser draws its
 * own range input there (issue #895).
 */
export function ZoomSlider({
  label,
  zoom,
  disabled = false,
  onZoom,
  className = "mt-3",
}: {
  label: string;
  zoom: number;
  disabled?: boolean;
  onZoom: (zoom: number) => void;
  /** The room above the slider in its place. */
  className?: string;
}) {
  const filled = ((zoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)) * 100;
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <ZoomOut aria-hidden className="h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />
      <input
        type="range"
        aria-label={label}
        min={ZOOM_MIN}
        max={ZOOM_MAX}
        step={0.01}
        value={zoom}
        disabled={disabled}
        onChange={(e) => onZoom(Number(e.target.value))}
        // The filled part is a gradient with a stop at the zoom, which no class can take; the rest shows the track's white-10.
        style={{ backgroundImage: `linear-gradient(to right, ${brand.accent} ${filled}%, transparent ${filled}%)` }}
        className={`h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white-10 ${CONTENT_FOCUS} [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-prt-text [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-prt-text`}
      />
      <ZoomIn aria-hidden className="h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />
    </div>
  );
}
