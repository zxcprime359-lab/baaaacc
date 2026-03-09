import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";

// ─── Worker URLs ──────────────────────────────────────────────────────────────
const SHOWBOX_WORKER = "https://mute-resonance-ab25.zxcprime362.workers.dev";
const FEBBOX_SHARE_WORKER = "https://super-king-4c14.zxcprime362.workers.dev";
const FEBBOX_PLAYER_WORKER = "https://muddy-mode-4bb2.zxcprime362.workers.dev";

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

    // ── Referer guard ─────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1 — ShowBox: get FebBox share link
    // ─────────────────────────────────────────────────────────────────────────
    const showboxQs = new URLSearchParams({
      type: mediaType === "tv" ? "tv" : "movie",
      title: title,
      year: String(year),
    });
    if (mediaType === "tv" && season) showboxQs.set("season", String(season));
    if (mediaType === "tv" && episode)
      showboxQs.set("episode", String(episode));

    const showboxRes = await fetchWithTimeout(
      `${SHOWBOX_WORKER}/?${showboxQs}`,
      {},
      8000,
    );

    if (!showboxRes.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "ShowBox worker failed",
          status: showboxRes.status,
        },
        { status: 502 },
      );
    }

    const showboxData = await showboxRes.json();
    const shareLink: string | undefined =
      showboxData?.source_response?.data?.link;

    if (!shareLink) {
      return NextResponse.json(
        {
          success: false,
          error: "No FebBox share link from ShowBox",
          showbox: showboxData,
        },
        { status: 404 },
      );
    }

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

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2 — FebBox share: list files, pick best quality
    // ─────────────────────────────────────────────────────────────────────────
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

    // Files are already sorted best quality first (4K → 1080p → 720p)
    // Pick best non-CAM source, fallback to first file
    const bestFile =
      files.find((f) => f.source !== "CAM" && f.quality === "4K") ??
      files.find((f) => f.source !== "CAM" && f.quality === "1080p") ??
      files.find((f) => f.source !== "CAM" && f.quality !== "unknown") ??
      files[0];

    const fid = bestFile.data_id;

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3 — FebBox player: get HLS streams + subtitles
    // ─────────────────────────────────────────────────────────────────────────
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

    // Prefer auto (adaptive) which serves highest quality available,
    // fallback to explicit quality labels
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

    // ─────────────────────────────────────────────────────────────────────────
    // Return
    // ─────────────────────────────────────────────────────────────────────────
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
