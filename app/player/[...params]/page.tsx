"use client";
import { Tailspin } from "ldrs/react";
import { useEffect, useRef, useState } from "react";
import "ldrs/react/Tailspin.css";

import { ArrowRight, Settings, Volume2, VolumeX } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import useMovieById from "@/hook/get-movie-by-id";
import { AnimatePresence, motion } from "framer-motion";
import { getStatusLabel } from "./hooks/SERVER-LABELS";
import { Slider } from "@/components/ui/slider";
import { LineSpinner } from "ldrs/react";
import "ldrs/react/LineSpinner.css";

import {
  IconBadgeCc,
  IconBadgeCcFilled,
  IconChevronLeft,
  IconMaximize,
  IconMinimize,
  IconPictureInPictureOff,
  IconPictureInPictureOn,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconPlayerSkipForwardFilled,
  IconRewindBackward15,
  IconRewindForward15,
} from "@tabler/icons-react";
import { useServerManager } from "./hooks/useServerManager";
import { useVideoPlayer } from "./hooks/useVideoPlayer";
import { useVideoSource } from "./hooks/useVideoSource";
import { useHiddenOverlay } from "@/lib/hide-overlay";
import { useIsMobile } from "@/hook/use-mobile";
import Pause from "./pause";
import { useFullscreen } from "@/lib/player-fullscreen";
import { Button } from "@/components/ui/button";
import { useVideoAudio } from "./hooks/useVideoAudio";
import PlayerSettings from "./settings";
import { useSubtitles } from "@/hook/subtitle-hooks";
import { useOpenSubtitle } from "@/hook/open-subtitle";
import { useOpenSubtitleVtt } from "@/hook/srt-to-vvt";
import Link from "next/link";
import Episodes from "./episodes";
import Failed from "./failed";
import useIntro from "@/hook/intro";
import PlayerServer from "./servers";
import DynamicTip from "./dynamic-tip";
import { useAdStore } from "@/store/ad-store";
/* ================= TYPES ================= */

export default function Player() {
  const { params } = useParams();
  const media_type = String(params?.[0]);
  const id = Number(params?.[1]);
  const season = Number(params?.[2]) || 1;
  const episode = Number(params?.[3]) || 1;
  const containerRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const backButton = searchParams.get("back");
  const [loaded, setLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isMobile = useIsMobile();
  const sliderRef = useRef<HTMLDivElement>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [selectedSub, setSelectedSub] = useState<string>("");
  const [subtitleOffset, setSubtitleOffset] = useState(0);
  const [hoverX, setHoverX] = useState(0);
  const [toggleSub, setToggleSub] = useState(true);
  const defaultServer = Number(searchParams.get("server")) ?? 0;
  const autoPlay = Boolean(searchParams.get("autoplay")) ?? false;
  const router = useRouter();
  const { isVisible, hideOverlay, resetTimer, setIsVisible, lockTimer } =
    useHiddenOverlay(isMobile ? 15000 : 3000);
  //TMDB METADATA
  const { data: metadata } = useMovieById({
    media_type,
    id,
  });

  const title = metadata?.title || metadata?.name || "";
  const date = metadata?.release_date ?? metadata?.first_air_date;
  const year = date ? String(new Date(date).getFullYear()) : "";
  const imdbId = metadata?.external_ids?.imdb_id ?? null;
  const {
    isPlaying,
    currentTime,
    duration,
    buffered,
    isBuffering,
    isInitializing,
    togglePlay,
    handleSeekChange,
    handleSeekCommit,
    jumpForward10,
    jumpBackward10,
    isEnded,
    skipTo,
    isFiveMinutesLeft,
    skipToTime,
    isPiPActive,
    togglePiP,
  } = useVideoPlayer({ videoRef, id, media_type, season, episode });
  // console.log("isInitializing", isInitializing);
  const {
    server,
    servers,
    serverIndex,
    source,
    serversFailed,
    controls,
    itemRefs,
    handleSelectServer,
    updateServerStatus,
    handleRefreshServers,
  } = useServerManager({
    media_type,
    id,
    season,
    episode,
    imdbId,
    containerRef,
    defaultServer,
    title,
    year,
  });
  const {
    quality,
    selectedQuality,
    setSelectedQuality,
    audioTracks,
    selectedAudio,
    setSelectedAudio,
  } = useVideoSource({
    videoRef,
    source,
    updateServerStatus,
    serverIndex,
  });

  const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef);
  const handleMouseClick = () => {
    if (!isVisible) {
      resetTimer(); // first interaction
    } else {
      togglePlay(); // second interaction
      resetTimer();
    }
  };
  const handleTouchClick = () => {
    if (isVisible) {
      hideOverlay(); // first interaction
    } else {
      resetTimer();
    }
  };
  //VOLUME HOOK
  const { volume, isMuted, handleVolumeChange, toggleMute } = useVideoAudio({
    videoRef,
    autoPlay,
  });
  const handleSliderHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!sliderRef.current || !duration) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;

    const percent = Math.min(Math.max(x / rect.width, 0), 1);
    const time = percent * duration;

    setHoverX(x);
    setHoverTime(time);
  };

  const clearHover = () => {
    setHoverTime(null);
  };
  // SUBTITLE HOOK
  // const { data: data_sub } = useLibreSubsTV({
  //   imdbId: metadata?.external_ids?.imdb_id ?? "",
  //   season: media_type === "tv" ? season : undefined,
  //   episode: media_type === "tv" ? episode : undefined,
  // });
  // const { data: vdrk_sub } = useSubtitles({
  //   tmdbId: metadata?.id,
  //   media_type: media_type,
  //   season: media_type === "tv" ? season : undefined,
  //   episode: media_type === "tv" ? episode : undefined,
  // });
  const { data: openSubtitle } = useOpenSubtitle({
    imdbId: imdbId ?? "",
    season: media_type === "tv" ? season : undefined,
    episode: media_type === "tv" ? episode : undefined,
  });

  const englishDefault =
    (openSubtitle ?? []).find(
      (s) => s.language.startsWith("English") && !s.isHearingImpaired,
    )?.downloadLink ?? null;

  useEffect(() => {
    if (englishDefault) setSelectedSub(englishDefault);
  }, [englishDefault]);
  const { data: openSubVttUrl } = useOpenSubtitleVtt(selectedSub || null);
  useEffect(() => {
    console.log("selectedSub changed to:", selectedSub);
  }, [selectedSub]);
  useEffect(() => {
    console.log("openSubVttUrl", openSubVttUrl);
  }, [openSubVttUrl]);

  const allSeason = metadata?.seasons?.length ?? 0;

  const activeSeason = metadata?.seasons?.find(
    (s) => s.season_number === season,
  );

  const episodeCount = activeSeason?.episode_count ?? 0;
  let nextSeason = season;
  let nextEpisode = episode;
  let canNext = true;

  if (episode < episodeCount) {
    nextEpisode = episode + 1;
  } else if (season < allSeason) {
    nextSeason = season + 1;
    nextEpisode = 1;
  } else {
    canNext = false;
  }
  //SKIP INTRO
  const { data: introData, isLoading: introLoading } = useIntro({
    id: metadata?.external_ids?.imdb_id ?? "",
    season,
    episode,
    media_type,
  });
  const showSkipIntro =
    introData &&
    currentTime >= introData.start_sec &&
    currentTime < introData.end_sec;
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        togglePlay();
      }

      if (e.code === "ArrowLeft") {
        jumpBackward10();
      }

      if (e.code === "ArrowRight") {
        jumpForward10();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, jumpBackward10, jumpForward10]);

  useEffect(() => {
    if (!isEnded) return;

    if (canNext) {
      router.push(`/player/tv/${id}/${nextSeason}/${nextEpisode}`);
    }
  }, [isEnded]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tracks = video.textTracks;
    if (tracks.length === 0) return;

    const track = tracks[0];
    if (!track.cues) return;

    // Store original times on first load
    for (let i = 0; i < track.cues.length; i++) {
      const cue = track.cues[i] as any;
      if (cue.originalStartTime === undefined) {
        cue.originalStartTime = cue.startTime;
        cue.originalEndTime = cue.endTime;
      }
    }

    // Apply offset to all cues
    for (let i = 0; i < track.cues.length; i++) {
      const cue = track.cues[i] as any;
      cue.startTime = cue.originalStartTime + subtitleOffset;
      cue.endTime = cue.originalEndTime + subtitleOffset;
    }
  }, [subtitleOffset, openSubVttUrl, selectedSub]);
  const triggerAd = useAdStore((state) => state.triggerAd);
  return (
    <div
      ref={containerRef}
      onPointerMove={(e) => {
        if (e.pointerType === "mouse") {
          resetTimer();
        }
      }}
      onPointerDown={(e) => {
        if (e.pointerType === "touch") {
          handleTouchClick();
          // console.log("touch clicked");
        }
      }}
      onPointerUp={(e) => {
        if (e.pointerType === "mouse") {
          handleMouseClick();
          // console.log("mouse clicked");
        }
      }}
      className={`relative h-dvh w-full bg-black overflow-hidden flex justify-center items-center ${
        isVisible ? "cursor-default" : "cursor-none"
      }`}
      onClick={triggerAd}
    >
      <video muted={autoPlay} className="h-full w-full" ref={videoRef}>
        {openSubVttUrl && !isInitializing && toggleSub && (
          <track
            key={openSubVttUrl}
            kind="subtitles"
            src={openSubVttUrl}
            default
          />
        )}
      </video>
      {serversFailed && (
        <Failed
          media_type={media_type}
          id={id}
          season={season}
          episode={episode}
          handleRefreshServers={handleRefreshServers}
        />
      )}
      <AnimatePresence>
        {(isBuffering || isInitializing) && source && !serversFailed && (
          <motion.div
            key="loader1"
            className="absolute "
            initial={{ opacity: 0, scale: 1.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            transition={{ duration: 0.05 }}
          >
            <Tailspin size="80" stroke="8" speed="0.9" color="red" />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {!isPlaying &&
          servers[serverIndex].status === "available" &&
          !isVisible &&
          !isInitializing &&
          !isBuffering &&
          metadata && <Pause metadata={metadata} />}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        {!serversFailed && servers[serverIndex].status !== "available" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute z-20 inset-0  overflow-hidden"
          >
            {metadata && (
              <div className="absolute left-[5%] -translate-x-[5%]  z-10 top-[50%] lg:-translate-y-[50%] -translate-y-[50%] lg:max-w-3xl max-w-lg w-full p-4 lg:block hidden">
                <h3 className="lg:text-xl text-muted-foreground font-medium text-sm">
                  You're watching
                </h3>
                <h1 className="lg:text-6xl text-3xl font-bold text-white mt-1">
                  {metadata.name || metadata.title}
                </h1>
                <h1 className="lg:text-xl font-semibold lg:mt-4 mt-2 italic">
                  {metadata.tagline}
                </h1>

                <div className="w-32 h-0.5 bg-red-900 mt-4"></div>
                <p className="lg:mt-8 mt-4 lg:text-xl  text-muted-foreground">
                  {metadata.overview}
                </p>
              </div>
            )}
            <motion.div
              animate={controls}
              className="absolute right-0 lg:p-20 z-20"
            >
              {servers.map((s, idx) => (
                <div
                  key={s.server}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  className={`lg:py-8 py-4 text-right opacity-0 space-y-1 transition-transform duration-200 ${
                    idx === serverIndex
                      ? "lg:-translate-x-15 -translate-x-10 opacity-100"
                      : idx === serverIndex + 1
                        ? "lg:-translate-x-10 -translate-x-5 opacity-100"
                        : idx === serverIndex - 1
                          ? "lg:-translate-x-10 -translate-x-5 opacity-100"
                          : idx === serverIndex - 2
                            ? "lg:opacity-50"
                            : idx === serverIndex + 2
                              ? "lg:opacity-50"
                              : ""
                  }`}
                >
                  <h1
                    className={` transition-transform duration-200 ${
                      s.status === "failed" ? "line-through" : ""
                    } ${
                      idx === serverIndex
                        ? "lg:text-4xl text-xl font-bold"
                        : idx === serverIndex + 1
                          ? "lg:text-2xl text-base text-foreground/35"
                          : idx === serverIndex - 1
                            ? "lg:text-2xl text-base text-foreground/35"
                            : idx === serverIndex - 2
                              ? "lg:text-lg text-sm text-foreground/15"
                              : idx === serverIndex + 2
                                ? "lg:text-lg text-sm text-foreground/15"
                                : ""
                    }`}
                  >
                    {s.name}
                  </h1>
                  <h3
                    className={`transition-transform duration-200 text-sm${
                      idx === serverIndex
                        ? "text-foreground/80"
                        : idx === serverIndex + 1
                          ? " text-foreground/30"
                          : idx === serverIndex - 1
                            ? " text-foreground/30"
                            : idx === serverIndex - 2
                              ? "text-foreground/10"
                              : idx === serverIndex + 2
                                ? "text-foreground/10"
                                : ""
                    }`}
                  >
                    {s.desc}
                  </h3>
                  <span className=" font-medium  ">
                    {getStatusLabel(s.status)}
                  </span>
                </div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {metadata &&
          (isInitializing || servers[serverIndex].status !== "available") &&
          !serversFailed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className={`absolute inset-0 
    before:absolute before:inset-0 
    before:z-10 
    before:content-[''] 
    before:bg-linear-to-l
    lg:before:from-black/80
    before:from-black/30 
    before:via-transparent 
    lg:before:to-black/80
    before:to-black/30 
    
    `}
            >
              <img
                className={`relative z-0 h-full w-full object-cover  transition duration-400  ${servers[serverIndex].status !== "available" ? "brightness-60" : "brightness-80"}   ${loaded ? "opacity-100 blur-none" : "opacity-0 blur-2xl"}`}
                src={`https://image.tmdb.org/t/p/original/${metadata.backdrop_path}`}
                alt=""
                onLoad={() => setLoaded(true)}
              />

              {isInitializing &&
                servers[serverIndex].status === "available" && (
                  <>
                    <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2">
                      <Tailspin
                        size="80"
                        stroke="8"
                        speed="0.9"
                        color="white"
                      />
                    </div>
                    <DynamicTip />
                  </>
                )}
            </motion.div>
          )}
      </AnimatePresence>
      <AnimatePresence>
        {(servers[serverIndex].status === "available" || serversFailed) &&
          (isVisible || isInitializing) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="lg:p-6 p-2 z-30 absolute top-0 inset-x-0"
            >
              <div
                className={`flex  items-start ${
                  backButton ? "justify-between" : "justify-end"
                }`}
              >
                {backButton && (
                  <span className="flex items-center gap-2 ">
                    <button
                      className=" relative lg:size-7 size-6 flex items-center justify-center "
                      onClick={() => router.back()}
                    >
                      <IconChevronLeft className="absolute lg:size-10 size-8 text-gray-300" />
                    </button>
                    <p className=" font-medium lg:text-base text-sm text-muted-foreground">
                      BACK
                    </p>
                  </span>
                )}
                <PlayerServer
                  servers={servers}
                  lockTimer={lockTimer}
                  resetTimer={resetTimer}
                  server={server}
                  setServer={handleSelectServer}
                  serverIndex={serverIndex}
                />
              </div>
            </motion.div>
          )}
      </AnimatePresence>

      <AnimatePresence>
        {isMobile &&
          servers[serverIndex].status === "available" &&
          isVisible &&
          !isBuffering &&
          !serversFailed &&
          !isInitializing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute flex gap-8  z-20"
            >
              <button
                className=""
                onPointerMove={(e) => {
                  e.stopPropagation();
                  if (e.pointerType === "mouse") {
                    lockTimer();
                  }
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (e.pointerType === "touch") {
                    jumpBackward10();
                    resetTimer();
                  }
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  if (e.pointerType === "mouse") {
                    jumpBackward10();
                    resetTimer();
                  }
                }}
              >
                <IconRewindBackward15 className="text-gray-100 size-8.5" />
              </button>
              <AnimatePresence mode="wait">
                <button
                  className="relative flex justify-center items-center size-11"
                  onPointerMove={(e) => {
                    e.stopPropagation();
                    if (e.pointerType === "mouse") {
                      lockTimer();
                    }
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (e.pointerType === "touch") {
                      resetTimer();
                    }
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    if (e.pointerType === "mouse") {
                      resetTimer();
                    }
                  }}
                  onClick={togglePlay}
                >
                  {isPlaying ? (
                    <motion.div
                      key="pause"
                      initial={{ opacity: 0, scale: 1.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.5 }}
                      transition={{ duration: 0.05 }}
                      className="absolute"
                    >
                      <IconPlayerPauseFilled className="size-13 text-gray-100" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="play"
                      initial={{ opacity: 0, scale: 1.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.5 }}
                      transition={{ duration: 0.05 }}
                      className="absolute"
                    >
                      <IconPlayerPlayFilled className=" size-12  text-gray-100" />
                    </motion.div>
                  )}
                </button>
              </AnimatePresence>
              <button
                className=""
                onPointerMove={(e) => {
                  e.stopPropagation();
                  if (e.pointerType === "mouse") {
                    lockTimer();
                  }
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (e.pointerType === "touch") {
                    jumpForward10();
                    resetTimer();
                  }
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  if (e.pointerType === "mouse") {
                    jumpForward10();
                    resetTimer();
                  }
                }}
              >
                <IconRewindForward15 className="text-gray-100 size-8.5" />
              </button>
            </motion.div>
          )}
      </AnimatePresence>
      <AnimatePresence>
        {servers[serverIndex].status === "available" &&
          isVisible &&
          !isInitializing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="lg:p-6  p-2 lg:space-y-6 space-y-3 bg-linear-to-b to-black/90 via-black/60 from-transparent bottom-0 absolute w-full"
            >
              <div className=" flex justify-between items-end gap-6">
                <div>
                  <p className="lg:text-base text-sm text-gray-200 flex  items-center gap-3 ">
                    You're watching
                  </p>
                  <h1 className="lg:text-4xl text-2xl font-bold lg:mt-1 mt-1 line-clamp-1">
                    {metadata?.title || metadata?.name} (
                    {(
                      metadata?.release_date || metadata?.first_air_date
                    )?.slice(0, 4)}
                    )
                  </h1>
                  <span className="flex gap-3  text-muted-foreground lg:text-base lg:mt-1 mt-1.5">
                    <p className="">{metadata?.genres[0].name}</p> |
                    <p className="">{metadata?.status}</p>
                    {media_type === "tv" && (
                      <>
                        |
                        <p>
                          S{season}E{episode}
                        </p>
                      </>
                    )}
                  </span>
                </div>

                {showSkipIntro &&
                  !isInitializing &&
                  (isPlaying || isVisible) && (
                    <Button
                      className=""
                      variant="secondary"
                      onPointerMove={(e) => {
                        e.stopPropagation();
                        if (e.pointerType === "mouse") {
                          lockTimer();
                        }
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        if (e.pointerType === "touch") {
                          skipToTime(introData.end_sec);
                          resetTimer();
                        }
                      }}
                      onPointerUp={(e) => {
                        e.stopPropagation();
                        if (e.pointerType === "mouse") {
                          skipToTime(introData.end_sec);
                          resetTimer();
                        }
                      }}
                    >
                      Skip Intro <ArrowRight />
                    </Button>
                  )}
              </div>
              <div className="space-y-1.5">
                <div
                  ref={sliderRef}
                  className="relative flex-1 cursor-pointer"
                  // onMouseMove={handleSliderHover}
                  // onMouseLeave={clearHover}

                  onPointerMove={(e) => {
                    e.stopPropagation();
                    if (e.pointerType === "mouse") {
                      lockTimer();
                      handleSliderHover(e);
                    }
                    if (e.pointerType === "touch") {
                      lockTimer();
                      handleSliderHover(e);
                    }
                  }}
                  onPointerLeave={(e) => {
                    if (e.pointerType === "mouse") {
                      resetTimer();
                      clearHover();
                    }
                    if (e.pointerType === "touch") {
                      resetTimer();
                      clearHover();
                    }
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                  }}
                >
                  {source?.type === "hls" && (
                    <div className="absolute inset-0 rounded ">
                      <div
                        className="h-full bg-muted-foreground/50 rounded"
                        style={{ width: `${buffered * 100}%` }}
                      />
                    </div>
                  )}
                  {/* Tooltip */}
                  {hoverTime !== null && (
                    <div
                      className="absolute -top-8 px-2  text-xs rounded bg-background/70 backdrop-blur-2xl text-foreground pointer-events-none z-40"
                      style={{
                        left: hoverX,
                        transform: "translateX(-50%)",
                      }}
                    >
                      {formatTime(hoverTime)}
                    </div>
                  )}

                  <Slider
                    value={[currentTime]}
                    max={duration}
                    step={0.1}
                    onValueChange={handleSeekChange}
                    onValueCommit={handleSeekCommit}
                    className="relative z-10"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration - currentTime)}</span>
                </div>
              </div>
              {isMobile ? (
                <div className="flex justify-between items-center gap-4 px-1">
                  <motion.div
                    variants={parentVariants}
                    initial="initial"
                    whileHover="hover"
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-3 group"
                    onPointerMove={(e) => {
                      e.stopPropagation();
                      if (e.pointerType === "mouse") {
                        lockTimer();
                      }
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (e.pointerType === "touch") {
                        lockTimer();
                      }
                    }}
                    onPointerUp={(e) => {
                      e.stopPropagation();
                      if (e.pointerType === "mouse") {
                        lockTimer();
                      }
                    }}
                  >
                    <span
                      className="cursor-pointer"
                      onClick={() => {
                        toggleMute();
                        lockTimer();
                      }}
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="lg:size-10 size-7.5 text-gray-200" />
                      ) : (
                        <Volume2 className="lg:size-10 size-7.5 text-gray-200" />
                      )}
                    </span>

                    <motion.div
                      variants={childVariants}
                      transition={{ duration: 0.1 }}
                      className="flex-1"
                    >
                      <Slider
                        max={100}
                        step={1}
                        value={[volume]}
                        onValueChange={handleVolumeChange}
                        className="cursor-pointer"
                      />
                    </motion.div>
                  </motion.div>

                  {media_type === "tv" && metadata && (
                    <Episodes
                      id={id}
                      season={season}
                      episode={episode}
                      metadata={metadata}
                      lockTimer={lockTimer}
                      resetTimer={resetTimer}
                      server={defaultServer}
                      autoPlay={autoPlay}
                    />
                  )}
                  <button
                    onPointerMove={(e) => {
                      e.stopPropagation();
                      if (e.pointerType === "mouse") {
                        lockTimer();
                      }
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (e.pointerType === "touch") {
                        setToggleSub((prev) => !prev);
                        resetTimer();
                      }
                    }}
                    onPointerUp={(e) => {
                      e.stopPropagation();
                      if (e.pointerType === "mouse") {
                        setToggleSub((prev) => !prev);
                        resetTimer();
                      }
                    }}
                    className="cursor-pointer"
                  >
                    {toggleSub ? (
                      <IconBadgeCcFilled className="lg:size-10.5 size-8.5 text-gray-200" />
                    ) : (
                      <IconBadgeCc className="lg:size-10.5 size-8.5 text-gray-200" />
                    )}
                  </button>
                  <PlayerSettings
                    quality={quality}
                    selectedQualty={selectedQuality}
                    setSelectedQualty={setSelectedQuality}
                    servers={servers}
                    lockTimer={lockTimer}
                    resetTimer={resetTimer}
                    server={server}
                    setServer={handleSelectServer}
                    audioTracks={audioTracks}
                    selectedAudio={selectedAudio}
                    setSelectedAudio={setSelectedAudio}
                    data_sub={openSubtitle ?? []}
                    selectedSub={selectedSub}
                    setSelectedSub={setSelectedSub}
                    subtitleOffset={subtitleOffset}
                    setSubtitleOffset={setSubtitleOffset}
                  />

                  <button
                    onPointerMove={(e) => {
                      e.stopPropagation();
                      if (e.pointerType === "mouse") {
                        lockTimer();
                      }
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (e.pointerType === "touch") {
                        togglePiP();
                        resetTimer();
                      }
                    }}
                    onPointerUp={(e) => {
                      e.stopPropagation();
                      if (e.pointerType === "mouse") {
                        togglePiP();
                        resetTimer();
                      }
                    }}
                    className="cursor-pointer"
                  >
                    {isPiPActive ? (
                      <IconPictureInPictureOn className="lg:size-10.5 size-8.5 text-gray-200" />
                    ) : (
                      <IconPictureInPictureOff className="lg:size-10.5 size-8.5 text-gray-200" />
                    )}
                  </button>
                  <button
                    onPointerMove={(e) => {
                      e.stopPropagation();
                      if (e.pointerType === "mouse") {
                        lockTimer();
                      }
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (e.pointerType === "touch") {
                        toggleFullscreen();
                        resetTimer();
                      }
                    }}
                    onPointerUp={(e) => {
                      e.stopPropagation();
                      if (e.pointerType === "mouse") {
                        toggleFullscreen();
                        resetTimer();
                      }
                    }}
                    className="cursor-pointer"
                  >
                    {isFullscreen ? (
                      <IconMinimize className="lg:lg:size-10 size-8 text-gray-200" />
                    ) : (
                      <IconMaximize className="lg:lg:size-10 size-8 text-gray-200" />
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex lg:justify-between justify-center items-center gap-4">
                  <span className="flex lg:gap-6 gap-6 items-center">
                    <AnimatePresence mode="wait">
                      <button
                        className="relative flex justify-center items-center size-10"
                        onPointerMove={(e) => {
                          e.stopPropagation();
                          if (e.pointerType === "mouse") {
                            lockTimer();
                          }
                        }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          if (e.pointerType === "touch") {
                            togglePlay();
                            resetTimer();
                          }
                        }}
                        onPointerUp={(e) => {
                          e.stopPropagation();
                          if (e.pointerType === "mouse") {
                            togglePlay();
                            resetTimer();
                          }
                        }}
                      >
                        {isPlaying ? (
                          <motion.div
                            key="pause"
                            initial={{ opacity: 0, scale: 1.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.5 }}
                            transition={{ duration: 0.05 }}
                            className="absolute"
                          >
                            <IconPlayerPauseFilled className="lg:size-12 size-8 text-gray-300" />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="play"
                            initial={{ opacity: 0, scale: 1.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.5 }}
                            transition={{ duration: 0.05 }}
                            className="absolute"
                          >
                            <IconPlayerPlayFilled className=" lg:size-11 size-7 text-gray-300" />
                          </motion.div>
                        )}
                      </button>
                    </AnimatePresence>
                    <button
                      className=""
                      onPointerMove={(e) => {
                        e.stopPropagation();
                        if (e.pointerType === "mouse") {
                          lockTimer();
                        }
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        if (e.pointerType === "touch") {
                          jumpBackward10();
                          resetTimer();
                        }
                      }}
                      onPointerUp={(e) => {
                        e.stopPropagation();
                        if (e.pointerType === "mouse") {
                          jumpBackward10();
                          resetTimer();
                        }
                      }}
                    >
                      <IconRewindBackward15 className="text-gray-300 lg:size-10 size-7" />
                    </button>

                    <button
                      className=""
                      onPointerMove={(e) => {
                        e.stopPropagation();
                        if (e.pointerType === "mouse") {
                          lockTimer();
                        }
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        if (e.pointerType === "touch") {
                          jumpForward10();
                          resetTimer();
                        }
                      }}
                      onPointerUp={(e) => {
                        e.stopPropagation();
                        if (e.pointerType === "mouse") {
                          jumpForward10();
                          resetTimer();
                        }
                      }}
                    >
                      <IconRewindForward15 className="text-gray-300 lg:size-10 size-7" />
                    </button>

                    <motion.div
                      variants={parentVariants}
                      initial="initial"
                      whileHover="hover"
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-3 group"
                      onPointerMove={(e) => {
                        e.stopPropagation();
                        if (e.pointerType === "mouse") {
                          lockTimer();
                        }
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        if (e.pointerType === "touch") {
                          lockTimer();
                        }
                      }}
                      onPointerUp={(e) => {
                        e.stopPropagation();
                        if (e.pointerType === "mouse") {
                          lockTimer();
                        }
                      }}
                    >
                      <span
                        className="cursor-pointer"
                        onClick={() => {
                          toggleMute();
                          lockTimer();
                        }}
                      >
                        {isMuted || volume === 0 ? (
                          <VolumeX className="lg:size-10 size-8 text-gray-200" />
                        ) : (
                          <Volume2 className="lg:size-10 size-8 text-gray-200" />
                        )}
                      </span>

                      <motion.div
                        variants={childVariants}
                        transition={{ duration: 0.1 }}
                        className="flex-1"
                      >
                        <Slider
                          max={100}
                          step={1}
                          value={[volume]}
                          onValueChange={handleVolumeChange}
                          className="cursor-pointer"
                        />
                      </motion.div>
                    </motion.div>
                    {media_type === "tv" && !isMobile && canNext && (
                      <button
                        onPointerMove={(e) => {
                          e.stopPropagation();
                        }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                        }}
                        onPointerUp={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <Link
                          className="flex items-center gap-1.5 text-gray-200 cursor-pointer"
                          href={`/player/tv/${id}/${nextSeason}/${nextEpisode}`}
                        >
                          <IconPlayerSkipForwardFilled className="lg:size-9.5 size-7.5" />
                          <h1>Next Episode</h1>
                        </Link>
                      </button>
                    )}
                  </span>
                  <span className="flex lg:gap-6 gap-6 items-center">
                    <PlayerSettings
                      quality={quality}
                      selectedQualty={selectedQuality}
                      setSelectedQualty={setSelectedQuality}
                      servers={servers}
                      lockTimer={lockTimer}
                      resetTimer={resetTimer}
                      server={server}
                      setServer={handleSelectServer}
                      audioTracks={audioTracks}
                      selectedAudio={selectedAudio}
                      setSelectedAudio={setSelectedAudio}
                      data_sub={openSubtitle ?? []}
                      selectedSub={selectedSub}
                      setSelectedSub={setSelectedSub}
                      subtitleOffset={subtitleOffset}
                      setSubtitleOffset={setSubtitleOffset}
                    />
                    {media_type === "tv" && metadata && (
                      <Episodes
                        id={id}
                        season={season}
                        episode={episode}
                        metadata={metadata}
                        lockTimer={lockTimer}
                        resetTimer={resetTimer}
                        server={1}
                        autoPlay={autoPlay}
                      />
                    )}
                    {/* <IconLayoutSidebarRightExpand className="size-9.5" />{" "} */}
                    <button
                      onPointerMove={(e) => {
                        e.stopPropagation();
                        if (e.pointerType === "mouse") {
                          lockTimer();
                        }
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        if (e.pointerType === "touch") {
                          setToggleSub((prev) => !prev);
                          resetTimer();
                        }
                      }}
                      onPointerUp={(e) => {
                        e.stopPropagation();
                        if (e.pointerType === "mouse") {
                          setToggleSub((prev) => !prev);
                          resetTimer();
                        }
                      }}
                      className="cursor-pointer"
                    >
                      {toggleSub ? (
                        <IconBadgeCcFilled className="lg:size-10.5 size-8.5 text-gray-200" />
                      ) : (
                        <IconBadgeCc className="lg:size-10.5 size-8.5 text-gray-200" />
                      )}
                    </button>
                    <button
                      onPointerMove={(e) => {
                        e.stopPropagation();
                        if (e.pointerType === "mouse") {
                          lockTimer();
                        }
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        if (e.pointerType === "touch") {
                          togglePiP();
                          resetTimer();
                        }
                      }}
                      onPointerUp={(e) => {
                        e.stopPropagation();
                        if (e.pointerType === "mouse") {
                          togglePiP();
                          resetTimer();
                        }
                      }}
                      className="cursor-pointer"
                    >
                      {isPiPActive ? (
                        <IconPictureInPictureOn className="lg:size-10.5 size-8.5 text-gray-200" />
                      ) : (
                        <IconPictureInPictureOff className="lg:size-10.5 size-8.5 text-gray-200" />
                      )}
                    </button>
                    <button
                      onPointerMove={(e) => {
                        e.stopPropagation();
                        if (e.pointerType === "mouse") {
                          lockTimer();
                        }
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        if (e.pointerType === "touch") {
                          toggleFullscreen();
                          resetTimer();
                        }
                      }}
                      onPointerUp={(e) => {
                        e.stopPropagation();
                        if (e.pointerType === "mouse") {
                          toggleFullscreen();
                          resetTimer();
                        }
                      }}
                      className="cursor-pointer"
                    >
                      {isFullscreen ? (
                        <IconMinimize className="lg:lg:size-10 size-8 text-gray-200" />
                      ) : (
                        <IconMaximize className="lg:lg:size-10 size-8 text-gray-200" />
                      )}
                    </button>
                  </span>
                </div>
              )}
            </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
}
function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0");

  const m = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");

  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");

  return `${h}:${m}:${s}`;
}

const timeString = new Date().toLocaleTimeString([], {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});
const parentVariants = {
  hover: { width: 160 },
  initial: { width: 40 },
};

const childVariants = {
  hover: { opacity: 1 },
  initial: { opacity: 0 },
};
