import React, { useState } from "react";
import { Music, ChevronDown, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const SPOTIFY_PLAYLIST_ID = "3VdORUUTqpr44E1MhW2Ohe";
const SPOTIFY_EMBED_URL = `https://open.spotify.com/embed/playlist/${SPOTIFY_PLAYLIST_ID}?utm_source=generator&theme=0&autoplay=1`;
const SPOTIFY_DIRECT_URL = `https://open.spotify.com/playlist/${SPOTIFY_PLAYLIST_ID}`;

export const RadioPlayer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-5 left-5 z-50 transition-all duration-300">
      {/* Expanded Spotify Card - Always mounted and rendered to preserve background audio playback */}
      <div
        className={`w-80 sm:w-96 glass-morphism rounded-2xl border border-[#39FF14]/40 shadow-[0_0_25px_rgba(57,255,20,0.25)] transition-all duration-300 origin-bottom-left ${
          isOpen
            ? "p-4 opacity-100 scale-100 mb-3 animate-in fade-in slide-in-from-bottom-5 duration-200"
            : "h-0 p-0 m-0 border-0 shadow-none opacity-0 scale-95 pointer-events-none overflow-hidden"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#39FF14]/20 border border-[#39FF14]/50 flex items-center justify-center text-[#39FF14]">
              <Music className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold font-['Orbitron'] text-white tracking-wide flex items-center gap-1.5">
                HCvape Playlist
                <span className="inline-block w-2 h-2 rounded-full bg-[#39FF14] shadow-[0_0_8px_#39FF14]" />
              </h4>
              <p className="text-[11px] text-zinc-400">Spotify Official</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <a
              href={SPOTIFY_DIRECT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-zinc-400 hover:text-[#39FF14] hover:bg-white/10 rounded-full transition-colors"
              title="Abrir no Spotify"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Spotify Player Iframe */}
        <div className="rounded-xl overflow-hidden border border-white/10 bg-black/60">
          <iframe
            src={SPOTIFY_EMBED_URL}
            width="100%"
            height="352"
            frameBorder="0"
            allowFullScreen
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            title="HCvape Spotify Playlist"
            className="rounded-xl"
          />
        </div>
      </div>

      {/* Collapsed Floating Trigger */}
      {!isOpen && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setIsOpen(true)}
              className="group relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-full glass-morphism border border-[#39FF14]/40 shadow-[0_0_20px_rgba(57,255,20,0.2)] hover:border-[#39FF14] hover:shadow-[0_0_25px_rgba(57,255,20,0.4)] transition-all duration-300"
            >
              <div className="relative flex items-center justify-center">
                <Music className="w-5 h-5 text-[#39FF14] transition-transform duration-300 group-hover:scale-110" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#39FF14] rounded-full animate-ping" />
              </div>

              <span className="text-xs font-semibold font-['Orbitron'] tracking-wider text-white hidden sm:inline-block">
                Playlist HC
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-black/90 border-[#39FF14]/40 text-white">
            <p className="text-xs font-['Orbitron'] flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-[#39FF14]" />
              Ouvir Playlist do Spotify
            </p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};

