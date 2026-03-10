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
      .from("streams")
      .select("*, stream_files(*)")
      .eq("tmdb_id", tmdbId)
      .eq("media_type", mediaType);

    if (season) query = query.eq("season", Number(season));
    else query = query.is("season", null);
    if (episode) query = query.eq("episode", Number(episode));
    else query = query.is("episode", null);

    const { data, error } = await query.maybeSingle();
    if (error) {
      console.warn("DB read error:", error.message);
      return null;
    }
    return data;
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
  showboxId: string | null,
  year: string,
  shareToken: string,
  link: string,
  files: any[],
) {
  try {
    const { data: stream, error: streamErr } = await supabase
      .from("streams")
      .insert({
        tmdb_id: tmdbId,
        media_type: mediaType,
        season: season ? Number(season) : null,
        episode: episode ? Number(episode) : null,
        movie_id: showboxId,
        year: Number(year),
        share_token: shareToken,
        link,
      })
      .select("id")
      .single();

    if (streamErr) {
      console.warn("DB stream insert error:", streamErr.message);
      return;
    }

    if (files.length > 0) {
      const fileRows = files.map((f: any) => ({
        stream_id: stream.id,
        data_id: f.data_id,
        file_name: f.file_name,
        file_size: f.file_size,
        file_type: f.file_type,
        file_time: f.file_time,
        quality: f.quality,
        source: f.source,
        codec: f.codec,
        hdr: f.hdr,
        year: f.year,
        thumbnail: f.thumbnail,
      }));
      const { error: filesErr } = await supabase
        .from("stream_files")
        .insert(fileRows);
      if (filesErr) console.warn("DB files insert error:", filesErr.message);
    }
  } catch (err: any) {
    console.warn("DB save exception:", err.message);
  }
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
    const token = searchParams.get("putanginamo")!;
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

    // CHECK DB
    const cached = await dbGet(tmdbId, mediaType, season, episode);

    if (cached) {
      const shareToken = cached.share_token;
      const files = cached.stream_files ?? [];

      const bestFile =
        files.find((f: any) => f.source !== "CAM" && f.quality === "4K") ??
        files.find((f: any) => f.source !== "CAM" && f.quality === "1080p") ??
        files.find((f: any) => f.source !== "CAM" && f.quality !== "unknown") ??
        files[0];

      const playerRes = await fetch(
        `${FEBBOX_PLAYER_WORKER}/?fid=${bestFile.data_id}&share_key=${shareToken}`,
      );
      const playerData = await playerRes.json();

      if (!playerData.success)
        return NextResponse.json(
          { success: false, error: "FebBox player error" },
          { status: 502 },
        );

      const streams: Record<string, string> = playerData.streams ?? {};
      const finalUrl =
        streams["1080p"] ??
        streams["auto"] ??
        streams["4k"] ??
        streams["720p"] ??
        streams["360p"] ??
        Object.values(streams)[0];

      return NextResponse.json({
        success: true,
        from_db: true,
        link: finalUrl,
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
      });
    }

    // NOT IN DB — send to worker
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

    // Save to DB if successful
    if (data.success && data.file) {
      const shareToken = data.shareToken;
      dbSave(
        tmdbId,
        mediaType,
        season,
        episode,
        null,
        year,
        shareToken,
        data.link,
        [data.file],
      ).catch((e: any) => console.warn("dbSave failed:", e.message));
    }

    return NextResponse.json(data, { status: workerRes.status });
  } catch (err: any) {
    console.error("API Error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
