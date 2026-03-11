import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const WORKER_URL = "https://main.jinluxuz.workers.dev";
const WORKER_SECRET = "xk92mZpQ7vLw3nRt";
const FEBBOX_PLAYER_WORKER = "https://febbox3.jinluxuz.workers.dev";

async function dbGet(
  tmdbId: string,
  mediaType: string,
  season: string | null,
  episode: string | null,
) {
  try {
    let query = supabase
      .from("meta")
      .select(
        `
        id,
        streams (
          id,
          share_token,
          stream_files (*)
        )
      `,
      )
      .eq("tmdb_id", Number(tmdbId))
      .eq("media_type", mediaType);

    if (season) query = query.eq("season", Number(season));
    else query = query.is("season", null);

    if (episode) query = query.eq("episode", Number(episode));
    else query = query.is("episode", null);

    const { data, error } = await query.maybeSingle();

    if (error || !data) return null;

    const stream = (data.streams as any[])?.[0];

    if (!stream) return null;

    return {
      share_token: stream.share_token,
      files: stream.stream_files ?? [],
    };
  } catch (err: any) {
    console.warn("DB read exception:", err.message);
    return null;
  }
}

async function dbSave(
  tmdbId: string,
  mediaType: string,
  season: string | null,
  episode: string | null,
  year: string,
  shareToken: string,
  files: any[],
) {
  try {
    const { error } = await supabase.rpc("save_stream", {
      p_tmdb_id: Number(tmdbId),
      p_media_type: mediaType,
      p_season: season ? Number(season) : null,
      p_episode: episode ? Number(episode) : null,
      p_year: Number(year),
      p_share_token: shareToken,
      p_files: files,
    });

    if (error) console.warn("[dbSave] error:", error);
  } catch (err: any) {
    console.warn("[dbSave] exception:", err.message);
  }
}

function selectBestFile(files: any[]) {
  return (
    files.find((f) => f.source !== "CAM" && f.quality === "4K") ??
    files.find((f) => f.source !== "CAM" && f.quality === "1080p") ??
    files.find((f) => f.source !== "CAM" && f.quality !== "unknown") ??
    files[0]
  );
}

function selectBestStream(streams: Record<string, string>): string {
  return (
    streams["1080p"] ??
    streams["auto"] ??
    streams["4K"] ??
    streams["4k"] ??
    streams["720p"] ??
    streams["360p"] ??
    Object.values(streams)[0]
  );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    const tmdbId = searchParams.get("a");
    const mediaType = searchParams.get("b");
    const season = searchParams.get("c");
    const episode = searchParams.get("d");
    const title = searchParams.get("f");
    const year = searchParams.get("g");
    const ts = Number(searchParams.get("gago"));
    const token = searchParams.get("putangnamo")!;
    const f_token = searchParams.get("f_token")!;

    if (!tmdbId || !mediaType || !title || !year || !ts || !token)
      return NextResponse.json(
        { success: false, error: "need token" },
        { status: 404 },
      );

    if (Date.now() - ts > 8000)
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 403 },
      );

    if (!validateBackendToken(tmdbId, f_token, ts, token))
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 403 },
      );

    const cached = await dbGet(tmdbId, mediaType, season, episode);

    if (cached) {
      const shareToken = cached.share_token;
      const files = cached.files ?? [];

      const bestFile = selectBestFile(files);

      if (!bestFile)
        return NextResponse.json(
          { success: false, error: "No files found" },
          { status: 404 },
        );

      const playerRes = await fetch(
        `${FEBBOX_PLAYER_WORKER}/?fid=${bestFile.data_id}&share_key=${shareToken}`,
      );

      const playerData = await playerRes.json();
      const streams: Record<string, string> = playerData.streams ?? {};
      const finalUrl = selectBestStream(streams);

      return NextResponse.json({
        success: true,
        from_db: true,
        link: finalUrl,
        type: "hls",
        streams,
        audio_tracks: playerData.audio_tracks ?? null,
        subtitles: playerData.subtitles ?? null,
        file: bestFile,
      });
    }

    const qs = new URLSearchParams({
      secret: WORKER_SECRET,
      title,
      year,
      mediaType,
      ...(season && { season }),
      ...(episode && { episode }),
    });

    const workerRes = await fetch(`${WORKER_URL}/?${qs}`);
    const data = await workerRes.json();

    if (!data.success)
      return NextResponse.json(data, { status: workerRes.status });

    const shareToken = data.shareToken;
    const files = data.files ?? [];

    if (files.length === 0)
      return NextResponse.json(
        { success: false, error: "No files found" },
        { status: 404 },
      );

    const bestFile = selectBestFile(files);

    dbSave(tmdbId, mediaType, season, episode, year, shareToken, files).catch(
      (e: any) => console.warn("dbSave failed:", e.message),
    );

    const playerRes = await fetch(
      `${FEBBOX_PLAYER_WORKER}/?fid=${bestFile.data_id}&share_key=${shareToken}`,
    );

    const playerData = await playerRes.json();
    const streams: Record<string, string> = playerData.streams ?? {};
    const finalUrl = selectBestStream(streams);

    return NextResponse.json({
      success: true,
      from_db: false,
      link: finalUrl,
      type: "hls",
      streams,
      audio_tracks: playerData.audio_tracks ?? null,
      subtitles: playerData.subtitles ?? null,
      file: bestFile,
    });
  } catch (err: any) {
    console.error("API Error:", err);

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
