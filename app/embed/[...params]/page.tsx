"use client";
import { useParams } from "next/navigation";
import { useState } from "react";
import "ldrs/react/Ring.css";
import { Tailspin } from "ldrs/react";
import "ldrs/react/Tailspin.css";
import { useAdStore } from "@/store/ad-store";
export default function ZXCPlayer() {
  const { params } = useParams() as { params?: string[] };
  const [isLoading, setIsLoading] = useState(true);

  const media_type = params?.[0];
  const id = params?.[1];
  const season = params?.[2];
  const episode = params?.[3];

  const query = new URLSearchParams({
    type: media_type || "",
    id: id || "",
    ...(media_type === "tv" && season && episode ? { season, episode } : {}),
  }).toString();

  const path = `/api/backupp?${query}`;
  console.log(path);
  const triggerAd = useAdStore((state) => state.triggerAd);
  return (
    <div
      className="relative w-full h-dvh bg-black overflow-hidden"
      onClick={triggerAd}
    >
      {/* Loading Screen */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
          <Tailspin size="80" stroke="7" speed="0.9" color="white" />
        </div>
      )}

      {/* Iframe */}
      <iframe
        src={path}
        className="absolute inset-0 w-full h-screen"
        frameBorder={0}
        allowFullScreen
        // Hide iframe until it's fully loaded
        style={{ opacity: isLoading ? 0 : 1 }}
        onLoad={() => setIsLoading(false)}
        // Optional: handle errors
        onError={() => setIsLoading(false)}
        sandbox="allow-scripts allow-same-origin allow-presentation"
      />
    </div>
  );
}
