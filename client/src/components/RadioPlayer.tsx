import React, { useState, useRef, useEffect } from "react";
import { Radio, Play, Pause, Volume2, VolumeX, ChevronDown, Music, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Station {
  id: string;
  name: string;
  genre: string;
  url: string;
  icon: string;
}

const STATIONS: Station[] = [
  {
    id: "lofi",
    name: "Lo-Fi Beats & Chill",
    genre: "Ambient / Relax",
    url: "https://ice2.somafm.com/groovesalad-128-mp3",
    icon: "🎧",
  },
  {
    id: "synthwave",
    name: "Cyber Synthwave",
    genre: "Futuristic / Synth",
    url: "https://ice2.somafm.com/defcon-128-mp3",
    icon: "⚡",
  },
  {
    id: "deeplounge",
    name: "Deep Space Lounge",
    genre: "Deep House / Chillout",
    url: "https://ice4.somafm.com/deepspaceone-128-mp3",
    icon: "🌌",
  },
];

export const RadioPlayer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStation, setCurrentStation] = useState<Station>(STATIONS[0]);
  const [volume, setVolume] = useState<number>(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [hasError, setHasError] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync volume with audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Handle station change
  const handleSelectStation = (station: Station) => {
    if (station.id === currentStation.id) return;
    setCurrentStation(station);
    setHasError(false);

    if (isPlaying && audioRef.current) {
      setIsLoading(true);
      audioRef.current.src = station.url;
      audioRef.current
        .play()
        .then(() => setIsLoading(false))
        .catch(() => {
          setIsPlaying(false);
          setIsLoading(false);
          setHasError(true);
        });
    }
  };

  // Toggle Play / Pause
  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      setHasError(false);
      
      // Force reload source if paused for a long time to keep live stream fresh
      audioRef.current.src = currentStation.url;
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error("Audio playback error:", err);
          setIsPlaying(false);
          setIsLoading(false);
          setHasError(true);
        });
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <div className="fixed bottom-5 left-5 z-50 transition-all duration-300">
      <audio
        ref={audioRef}
        src={currentStation.url}
        preload="none"
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => {
          setIsLoading(false);
          setIsPlaying(true);
        }}
        onError={() => {
          setIsLoading(false);
          setIsPlaying(false);
          setHasError(true);
        }}
      />

      {/* Expanded Radio Card */}
      {isOpen ? (
        <div className="w-80 sm:w-88 glass-morphism rounded-2xl p-4 border border-[#39FF14]/40 shadow-[0_0_25px_rgba(57,255,20,0.25)] animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#39FF14]/20 border border-[#39FF14]/50 flex items-center justify-center text-[#39FF14]">
                <Radio className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold font-['Orbitron'] text-white tracking-wide flex items-center gap-1.5">
                  HCvape Radio
                  <span className="inline-block w-2 h-2 rounded-full bg-[#39FF14] shadow-[0_0_8px_#39FF14]" />
                </h4>
                <p className="text-[11px] text-zinc-400">Transmissão ao vivo</p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>

          {/* Current Station Info */}
          <div className="bg-black/50 rounded-xl p-3 border border-white/5 mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-[#39FF14] flex items-center gap-1 font-['Orbitron']">
                <span>{currentStation.icon}</span> {currentStation.name}
              </span>
              {isPlaying && (
                <div className="flex items-center gap-0.5 h-3">
                  <span className="w-0.5 h-full bg-[#39FF14] animate-[bounce_1s_infinite_100ms]" />
                  <span className="w-0.5 h-full bg-[#39FF14] animate-[bounce_1s_infinite_300ms]" />
                  <span className="w-0.5 h-full bg-[#39FF14] animate-[bounce_1s_infinite_200ms]" />
                </div>
              )}
            </div>
            <p className="text-[11px] text-zinc-400">Gênero: {currentStation.genre}</p>
            {hasError && (
              <p className="text-[11px] text-red-400 mt-1">
                Servidor indisponível. Tente outra estação.
              </p>
            )}
          </div>

          {/* Station Selector */}
          <div className="space-y-1.5 mb-4">
            <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 font-['Orbitron'] mb-1">
              Estações
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {STATIONS.map((station) => {
                const isActive = station.id === currentStation.id;
                return (
                  <button
                    key={station.id}
                    onClick={() => handleSelectStation(station)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-0.5 border ${
                      isActive
                        ? "bg-[#39FF14]/20 text-[#39FF14] border-[#39FF14] shadow-[0_0_10px_rgba(57,255,20,0.3)]"
                        : "bg-zinc-900/60 text-zinc-400 border-white/5 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <span className="text-sm">{station.icon}</span>
                    <span className="truncate w-full text-center text-[10px]">
                      {station.name.split(" ")[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex items-center gap-3 pt-1 border-t border-white/10">
            {/* Play/Pause Button */}
            <button
              onClick={togglePlay}
              disabled={isLoading}
              className="w-10 h-10 rounded-full bg-[#39FF14] text-black flex items-center justify-center font-bold shadow-[0_0_15px_rgba(57,255,20,0.5)] hover:scale-105 active:scale-95 transition-all disabled:opacity-50 shrink-0"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5 fill-black" />
              ) : (
                <Play className="w-5 h-5 fill-black translate-x-0.5" />
              )}
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-2 flex-1">
              <button
                onClick={toggleMute}
                className="text-zinc-400 hover:text-[#39FF14] transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>

              <Slider
                value={[isMuted ? 0 : volume * 100]}
                min={0}
                max={100}
                step={1}
                onValueChange={(val) => {
                  setVolume(val[0] / 100);
                  if (isMuted && val[0] > 0) setIsMuted(false);
                }}
                className="flex-1 cursor-pointer"
              />
            </div>
          </div>
        </div>
      ) : (
        /* Collapsed Floating Trigger */
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setIsOpen(true)}
              className={`group relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-full glass-morphism border border-[#39FF14]/40 shadow-[0_0_20px_rgba(57,255,20,0.2)] hover:border-[#39FF14] hover:shadow-[0_0_25px_rgba(57,255,20,0.4)] transition-all duration-300 ${
                isPlaying ? "ring-2 ring-[#39FF14]/50" : ""
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Radio
                  className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${
                    isPlaying ? "text-[#39FF14]" : "text-zinc-300"
                  }`}
                />
                {isPlaying && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#39FF14] rounded-full animate-ping" />
                )}
              </div>

              <span className="text-xs font-semibold font-['Orbitron'] tracking-wider text-white hidden sm:inline-block">
                {isPlaying ? "Rádio On" : "Rádio HC"}
              </span>

              {/* Sound equalizer bars when playing */}
              {isPlaying && (
                <div className="flex items-end gap-0.5 h-3">
                  <span className="w-0.5 h-full bg-[#39FF14] animate-[bounce_0.8s_infinite_100ms]" />
                  <span className="w-0.5 h-full bg-[#39FF14] animate-[bounce_0.8s_infinite_300ms]" />
                  <span className="w-0.5 h-full bg-[#39FF14] animate-[bounce_0.8s_infinite_200ms]" />
                </div>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-black/90 border-[#39FF14]/40 text-white">
            <p className="text-xs font-['Orbitron'] flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-[#39FF14]" />
              Ouvir Rádio HCvape
            </p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};
