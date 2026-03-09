import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";

// ─── Worker URLs ──────────────────────────────────────────────────────────────
const SHOWBOX_WORKERS = [
  "https://mute-resonance-ab25.zxcprime362.workers.dev",
  "https://febbox.mosangfour.workers.dev",
  "https://shy-pine-01bc.zxcprime366.workers.dev/",
  // add more here
];

const FEBBOX_SHARE_WORKER = "https://super-king-4c14.zxcprime362.workers.dev";
const FEBBOX_PLAYER_WORKER = "https://muddy-mode-4bb2.zxcprime362.workers.dev";

// ─── Try each ShowBox worker until one succeeds ───────────────────────────────

async function fetchShowBox(qs: URLSearchParams): Promise<any> {
  // Shuffle so load is distributed randomly across workers
  const shuffled = [...SHOWBOX_WORKERS].sort(() => Math.random() - 0.5);

  for (const worker of shuffled) {
    try {
      const res = await fetchWithTimeout(`${worker}/?${qs}`, {}, 8000);
      if (!res.ok) continue;
      const data = await res.json();
      // Only accept if we actually got a share link
      if (data?.source_response?.data?.link) return data;
    } catch (_) {
      continue;
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const tmdbId = req.nextUrl.searchParams.get("a");
    const mediaType = req.nextUrl.searchParams.get("b");
    const season = req.nextUrl.searchParams.get("c");
    const episode = req.nextUrl.searchParams.get("d");
    const title = req.nextUrl.searchParams.get("f");
    const year = req.nextUrl.searchParams.get("g");
    const ts = Number(req.nextUrl.searchParams.get("gago"));
    const token = req.nextUrl.searchParams.get("putanginamo")!;
    const f_token = req.nextUrl.searchParams.get("f_token")!;

    if (!tmdbId || !mediaType || !title || !year || !ts || !token) {
      return NextResponse.json(
        { success: false, error: "need token" },
        { status: 404 },
      );
    }

    if (Date.now() - ts > 8000) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 403 },
      );
    }

    if (!validateBackendToken(tmdbId, f_token, ts, token)) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 403 },
      );
    }

    const referer = req.headers.get("referer") || "";
    if (
      !referer.includes("/api/") &&
      !referer.includes("localhost") &&
      !referer.includes("http://192.168.1.4:3000/") &&
      !referer.includes("https://www.zxcstream.xyz/") &&
      !referer.includes("https://zxcstream.xyz/") &&
      !referer.includes("https://www.zxcprime.site/") &&
      !referer.includes("https://zxcprime.site/")
    ) {
      return NextResponse.json(
        { success: false, error: "NAH" },
        { status: 403 },
      );
    }

    // STEP 1 — ShowBox
    const showboxQs = new URLSearchParams({
      type: mediaType === "tv" ? "tv" : "movie",
      title: title,
      year: String(year),
    });
    if (mediaType === "tv" && season) showboxQs.set("season", String(season));
    if (mediaType === "tv" && episode)
      showboxQs.set("episode", String(episode));

    const showboxData = await fetchShowBox(showboxQs);

    if (!showboxData) {
      return NextResponse.json(
        {
          success: false,
          error: "All ShowBox workers failed or returned no share link",
        },
        { status: 502 },
      );
    }

    const shareLink: string = showboxData.source_response.data.link;
    const shareToken = shareLink.split("/share/")[1];

    if (!shareToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Could not parse share token from: " + shareLink,
        },
        { status: 500 },
      );
    }

    // STEP 2 — FebBox share
    const shareRes = await fetchWithTimeout(
      `${FEBBOX_SHARE_WORKER}/?share=${shareToken}`,
      {},
      8000,
    );

    if (!shareRes.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "FebBox share worker failed",
          status: shareRes.status,
        },
        { status: 502 },
      );
    }

    const shareData = await shareRes.json();
    const files: any[] = shareData?.files ?? [];

    if (!files.length) {
      return NextResponse.json(
        {
          success: false,
          error: "No files found in FebBox share",
          share: shareData,
        },
        { status: 404 },
      );
    }

    const bestFile =
      files.find((f) => f.source !== "CAM" && f.quality === "4K") ??
      files.find((f) => f.source !== "CAM" && f.quality === "1080p") ??
      files.find((f) => f.source !== "CAM" && f.quality !== "unknown") ??
      files[0];

    const fid = bestFile.data_id;

    // STEP 3 — FebBox player
    const playerRes = await fetchWithTimeout(
      `${FEBBOX_PLAYER_WORKER}/?fid=${fid}&share_key=${shareToken}`,
      {},
      10000,
    );

    if (!playerRes.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "FebBox player worker failed",
          status: playerRes.status,
        },
        { status: 502 },
      );
    }

    const playerData = await playerRes.json();

    if (!playerData.success) {
      return NextResponse.json(
        { success: false, error: "FebBox player error", detail: playerData },
        { status: 502 },
      );
    }

    const streams: Record<string, string> = playerData.streams ?? {};

    const finalM3u8Url =
      streams["auto"] ??
      streams["4k"] ??
      streams["1080p"] ??
      streams["720p"] ??
      Object.values(streams)[0];

    if (!finalM3u8Url) {
      return NextResponse.json(
        { success: false, error: "No stream URL found in player response" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      link: finalM3u8Url,
      type: "hls",
      streams,
      audio_tracks: playerData.audio_tracks ?? null,
      subtitles: playerData.subtitles ?? null,
      file: {
        name: bestFile.file_name,
        size: bestFile.file_size,
        quality: bestFile.quality,
        source: bestFile.source,
        codec: bestFile.codec,
        hdr: bestFile.hdr,
      },
      metadata: showboxData.metadata ?? null,
    });
  } catch (err: any) {
    console.error("ShowBox/FebBox API Error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
