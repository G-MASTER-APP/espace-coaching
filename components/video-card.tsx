"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronRight, Link2, Play } from "lucide-react";

import { extractYouTubeId } from "@/lib/video";

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function VideoCard({ title, url }: { title: string; url: string }) {
  const [expanded, setExpanded] = useState(false);
  const youTubeId = extractYouTubeId(url);

  if (youTubeId) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {expanded ? (
          <div className="aspect-video w-full">
            <iframe
              src={`https://www.youtube.com/embed/${youTubeId}?autoplay=1`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="relative block aspect-video w-full"
          >
            <Image
              src={`https://img.youtube.com/vi/${youTubeId}/hqdefault.jpg`}
              alt={title}
              fill
              className="object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/25">
              <span className="flex size-12 items-center justify-center rounded-full bg-white/90 text-foreground">
                <Play className="size-5 fill-current" />
              </span>
            </span>
          </button>
        )}
        <p className="px-3 py-2 text-sm font-medium text-foreground">{title}</p>
      </div>
    );
  }

  const hostname = getHostname(url);

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm transition-all duration-150 active:scale-[0.98] hover:border-primary/30 hover:bg-secondary/40"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Link2 className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
        {hostname && <p className="truncate text-xs text-muted-foreground">{hostname}</p>}
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </a>
  );
}
