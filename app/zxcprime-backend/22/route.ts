// import { fetchWithTimeout } from "@/lib/fetch-timeout";
// import { NextRequest, NextResponse } from "next/server";
// import { validateBackendToken } from "@/lib/validate-token";
// import { createClient } from "@supabase/supabase-js";

// // ─── Supabase ─────────────────────────────────────────────────────────────────
// const supabase = createClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.SUPABASE_SERVICE_ROLE_KEY!,
// );

// // ─── Worker URLs ──────────────────────────────────────────────────────────────
// const SHOWBOX_WORKERS = [
//   "https://febbox.jinluxuz.workers.dev/",
//   "https://febbox.mosangfour.workers.dev",
//   "https://febbox.zxcprime359.workers.dev/",
//   "https://shy-pine-01bc.zxcprime366.workers.dev/",
//   // add more here
// ];

// const FEBBOX_SHARE_WORKER = "https://febbox2.jinluxuz.workers.dev";
// const FEBBOX_PLAYER_WORKER = "https://febbox3.jinluxuz.workers.dev";

// // ─── DB helpers ───────────────────────────────────────────────────────────────

// async function dbGet(
//   tmdbId: string,
//   mediaType: string,
//   season: string | null,
//   episode: string | null,
// ) {
//   try {
//     let query = supabase
//       .from("streams")
//       .select("*, stream_files(*)")
//       .eq("tmdb_id", tmdbId)
//       .eq("media_type", mediaType);

//     if (season) query = query.eq("season", Number(season));
//     else query = query.is("season", null);
//     if (episode) query = query.eq("episode", Number(episode));
//     else query = query.is("episode", null);

//     const { data, error } = await query.maybeSingle();
//     if (error) {
//       console.warn("DB read error:", error.message);
//       return null;
//     }
//     return data;
//   } catch (err: any) {
//     console.warn("DB read exception:", err.message);
//     return null;
//   }
// }

// async function dbSave(
//   tmdbId: string,
//   mediaType: string,
//   season: string | null,
//   episode: string | null,
//   showboxId: string | null,
//   year: string,
//   shareToken: string,
//   link: string,
//   files: any[],
// ) {
//   try {
//     const { data: stream, error: streamErr } = await supabase
//       .from("streams")
//       .insert({
//         tmdb_id: tmdbId,
//         media_type: mediaType,
//         season: season ? Number(season) : null,
//         episode: episode ? Number(episode) : null,
//         movie_id: showboxId,
//         year: Number(year),
//         share_token: shareToken,
//         link,
//       })
//       .select("id")
//       .single();

//     if (streamErr) {
//       console.warn("DB stream insert error:", streamErr.message);
//       return;
//     }

//     if (files.length > 0) {
//       const fileRows = files.map((f: any) => ({
//         stream_id: stream.id,
//         data_id: f.data_id,
//         file_name: f.file_name,
//         file_size: f.file_size,
//         file_type: f.file_type,
//         file_time: f.file_time,
//         quality: f.quality,
//         source: f.source,
//         codec: f.codec,
//         hdr: f.hdr,
//         year: f.year,
//         thumbnail: f.thumbnail,
//       }));

//       const { error: filesErr } = await supabase
//         .from("stream_files")
//         .insert(fileRows);
//       if (filesErr) console.warn("DB files insert error:", filesErr.message);
//     }
//   } catch (err: any) {
//     console.warn("DB save exception:", err.message);
//   }
// }

// // ─── ShowBox worker pool ──────────────────────────────────────────────────────

// async function fetchShowBox(qs: URLSearchParams): Promise<any> {
//   const shuffled = [...SHOWBOX_WORKERS].sort(() => Math.random() - 0.5);
//   for (const worker of shuffled) {
//     try {
//       const res = await fetchWithTimeout(`${worker}/?${qs}`, {}, 8000);
//       if (!res.ok) continue;
//       const data = await res.json();
//       if (data?.source_response?.data?.link) return data;
//     } catch (_) {
//       continue;
//     }
//   }
//   return null;
// }

// // ─── Route ────────────────────────────────────────────────────────────────────

// export async function GET(req: NextRequest) {
//   try {
//     const tmdbId = req.nextUrl.searchParams.get("a");
//     const mediaType = req.nextUrl.searchParams.get("b");
//     const season = req.nextUrl.searchParams.get("c");
//     const episode = req.nextUrl.searchParams.get("d");
//     const title = req.nextUrl.searchParams.get("f");
//     const year = req.nextUrl.searchParams.get("g");
//     const ts = Number(req.nextUrl.searchParams.get("gago"));
//     const token = req.nextUrl.searchParams.get("putanginamo")!;
//     const f_token = req.nextUrl.searchParams.get("f_token")!;

//     if (!tmdbId || !mediaType || !title || !year || !ts || !token) {
//       return NextResponse.json(
//         { success: false, error: "need token" },
//         { status: 404 },
//       );
//     }

//     if (Date.now() - ts > 8000) {
//       return NextResponse.json(
//         { success: false, error: "Invalid token" },
//         { status: 403 },
//       );
//     }

//     if (!validateBackendToken(tmdbId, f_token, ts, token)) {
//       return NextResponse.json(
//         { success: false, error: "Invalid token" },
//         { status: 403 },
//       );
//     }

//     const referer = req.headers.get("referer") || "";
//     if (
//       !referer.includes("/api/") &&
//       !referer.includes("localhost") &&
//       !referer.includes("http://192.168.1.4:3000/") &&
//       !referer.includes("https://www.zxcstream.xyz/") &&
//       !referer.includes("https://zxcstream.xyz/") &&
//       !referer.includes("https://www.zxcprime.site/") &&
//       !referer.includes("https://zxcprime.site/")
//     ) {
//       return NextResponse.json(
//         { success: false, error: "NAH" },
//         { status: 403 },
//       );
//     }

//     // ─────────────────────────────────────────────────────────────────────────
//     // CHECK DB — skip Steps 1 & 2 if already stored
//     // ─────────────────────────────────────────────────────────────────────────
//     const cached = await dbGet(tmdbId, mediaType, season, episode);

//     let shareToken: string;
//     let files: any[];
//     let showboxMetadata: any = null;
//     let fromDb = false;

//     if (cached) {
//       shareToken = cached.share_token;
//       files = cached.stream_files ?? [];
//       fromDb = true;
//     } else {
//       // ─────────────────────────────────────────────────────────────────────
//       // STEP 1 — ShowBox: get FebBox share link
//       // ─────────────────────────────────────────────────────────────────────
//       const showboxQs = new URLSearchParams({
//         type: mediaType === "tv" ? "tv" : "movie",
//         title: title,
//         year: String(year),
//       });
//       if (mediaType === "tv" && season) showboxQs.set("season", String(season));
//       if (mediaType === "tv" && episode)
//         showboxQs.set("episode", String(episode));

//       const showboxData = await fetchShowBox(showboxQs);

//       console.log("dataaaaaaaaaaaaa", showboxData);
//       if (!showboxData) {
//         return NextResponse.json(
//           {
//             success: false,
//             error: "All ShowBox workers failed or returned no share link",
//           },
//           { status: 502 },
//         );
//       }

//       const shareLink: string = showboxData.source_response.data.link;
//       shareToken = shareLink.split("/share/")[1];
//       showboxMetadata = showboxData.metadata ?? null;
//       const showboxId =
//         showboxData.ids?.movie_id ?? showboxData.ids?.show_id ?? null;

//       if (!shareToken) {
//         return NextResponse.json(
//           {
//             success: false,
//             error: "Could not parse share token from: " + shareLink,
//           },
//           { status: 500 },
//         );
//       }

//       // ─────────────────────────────────────────────────────────────────────
//       // STEP 2 — FebBox share: get files list
//       // For TV, pass season + episode so worker drills into the season folder
//       // ─────────────────────────────────────────────────────────────────────
//       const shareQs = new URLSearchParams({ share: shareToken });
//       if (mediaType === "tv" && season) shareQs.set("season", String(season));
//       if (mediaType === "tv" && episode)
//         shareQs.set("episode", String(episode));

//       const shareRes = await fetchWithTimeout(
//         `${FEBBOX_SHARE_WORKER}/?${shareQs}`,
//         {},
//         8000,
//       );

//       if (!shareRes.ok) {
//         return NextResponse.json(
//           {
//             success: false,
//             error: "FebBox share worker failed",
//             status: shareRes.status,
//           },
//           { status: 502 },
//         );
//       }

//       const shareData = await shareRes.json();
//        console.log("shareDataaaaaaaaaaaaaaaa", shareData);
//       files = shareData?.files ?? [];

//       if (!files.length) {
//         return NextResponse.json(
//           {
//             success: false,
//             error: "No files found in FebBox share",
//             share: shareData,
//           },
//           { status: 404 },
//         );
//       }

//       // Save to DB — fire and forget, don't block the response
//       dbSave(
//         tmdbId,
//         mediaType,
//         season,
//         episode,
//         showboxId,
//         year,
//         shareToken,
//         shareLink,
//         files,
//       ).catch((e: any) => console.warn("dbSave failed:", e.message));
//     }

//     // ─────────────────────────────────────────────────────────────────────────
//     // STEP 3 — FebBox player: always fresh (stream URLs expire)
//     // ─────────────────────────────────────────────────────────────────────────
//     const bestFile =
//       files.find((f: any) => f.source !== "CAM" && f.quality === "4K") ??
//       files.find((f: any) => f.source !== "CAM" && f.quality === "1080p") ??
//       files.find((f: any) => f.source !== "CAM" && f.quality !== "unknown") ??
//       files[0];

//     const fid = bestFile?.data_id;

//     const playerRes = await fetchWithTimeout(
//       `${FEBBOX_PLAYER_WORKER}/?fid=${fid}&share_key=${shareToken}`,
//       {},
//       10000,
//     );

//     if (!playerRes.ok) {
//       return NextResponse.json(
//         {
//           success: false,
//           error: "FebBox player worker failed",
//           status: playerRes.status,
//         },
//         { status: 502 },
//       );
//     }

//     const playerData = await playerRes.json();

//     if (!playerData.success) {
//       return NextResponse.json(
//         { success: false, error: "FebBox player error", detail: playerData },
//         { status: 502 },
//       );
//     }

//     const streams: Record<string, string> = playerData.streams ?? {};

//     const finalM3u8Url =
//       streams["1080p"] ??
//       streams["auto"] ??
//       streams["4k"] ??
//       streams["720p"] ??
//       streams["360p"] ??
//       Object.values(streams)[0];

//     if (!finalM3u8Url) {
//       return NextResponse.json(
//         { success: false, error: "No stream URL found in player response" },
//         { status: 404 },
//       );
//     }

//     return NextResponse.json({
//       success: true,
//       from_db: fromDb,
//       link: finalM3u8Url,
//       type: "hls",
//       streams,
//       audio_tracks: playerData.audio_tracks ?? null,
//       subtitles: playerData.subtitles ?? null,
//       file: {
//         name: bestFile.file_name,
//         size: bestFile.file_size,
//         quality: bestFile.quality,
//         source: bestFile.source,
//         codec: bestFile.codec,
//         hdr: bestFile.hdr,
//       },
//       metadata: showboxMetadata,
//     });
//   } catch (err: any) {
//     console.error("ShowBox/FebBox API Error:", err);
//     return NextResponse.json(
//       { success: false, error: "Internal server error" },
//       { status: 500 },
//     );
//   }
// }
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ─── Worker URLs ──────────────────────────────────────────────────────────────
const FEBBOX_SHARE_WORKER = "https://febbox2.jinluxuz.workers.dev";
const FEBBOX_PLAYER_WORKER = "https://febbox3.jinluxuz.workers.dev";

// ─── DB helpers ───────────────────────────────────────────────────────────────

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

// ─── Search engine: get FebBox share link ─────────────────────────────────────

async function fetchShareLinkFromSearch(
  title: string,
  year: string,
): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(
      "http://localhost:3000/zxcprime-backend/search",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: `febbox ${title} ${year} shared by showbox`,
        }),
      },
      8000,
    );

    if (!res.ok) return null;

    const data = await res.json();
    const results: { url: string }[] = data?.results ?? [];

    // Find the first febbox.com/share/... URL
    for (const result of results) {
      const match = result.url.match(/febbox\.com\/share\/([A-Za-z0-9_-]+)/);
      if (match) return `https://www.febbox.com/share/${match[1]}`;
    }

    return null;
  } catch (err: any) {
    console.warn("Search engine error:", err.message);
    return null;
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

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

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK DB — skip Steps 1 & 2 if already stored
    // ─────────────────────────────────────────────────────────────────────────
    const cached = await dbGet(tmdbId, mediaType, season, episode);

    let shareToken: string;
    let files: any[];
    let fromDb = false;

    if (cached) {
      shareToken = cached.share_token;
      files = cached.stream_files ?? [];
      fromDb = true;
    } else {
      // ─────────────────────────────────────────────────────────────────────
      // STEP 1 — Search engine: get FebBox share link
      // ─────────────────────────────────────────────────────────────────────
      const shareLink = await fetchShareLinkFromSearch(title, year);

      console.log("shareLink from search", shareLink);

      if (!shareLink) {
        return NextResponse.json(
          {
            success: false,
            error: "Search engine returned no FebBox share link",
          },
          { status: 502 },
        );
      }

      shareToken = shareLink.split("/share/")[1];

      if (!shareToken) {
        return NextResponse.json(
          {
            success: false,
            error: "Could not parse share token from: " + shareLink,
          },
          { status: 500 },
        );
      }

      // ─────────────────────────────────────────────────────────────────────
      // STEP 2 — FebBox share: get files list
      // For TV, pass season + episode so worker drills into the season folder
      // ─────────────────────────────────────────────────────────────────────
      const shareQs = new URLSearchParams({ share: shareToken });
      if (mediaType === "tv" && season) shareQs.set("season", String(season));
      if (mediaType === "tv" && episode)
        shareQs.set("episode", String(episode));

      const shareRes = await fetchWithTimeout(
        `${FEBBOX_SHARE_WORKER}/?${shareQs}`,
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
      // console.log("shareDataaaaaaaaaaaaaaaa", shareData);
      files = shareData?.files ?? [];

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

      // Save to DB — fire and forget, don't block the response
      dbSave(
        tmdbId,
        mediaType,
        season,
        episode,
        null,
        year,
        shareToken,
        shareLink,
        files,
      ).catch((e: any) => console.warn("dbSave failed:", e.message));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3 — FebBox player: always fresh (stream URLs expire)
    // ─────────────────────────────────────────────────────────────────────────
    const bestFile =
      files.find((f: any) => f.source !== "CAM" && f.quality === "4K") ??
      files.find((f: any) => f.source !== "CAM" && f.quality === "1080p") ??
      files.find((f: any) => f.source !== "CAM" && f.quality !== "unknown") ??
      files[0];

    const fid = bestFile?.data_id;

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
      streams["1080p"] ??
      streams["auto"] ??
      streams["4k"] ??
      streams["720p"] ??
      streams["360p"] ??
      Object.values(streams)[0];

    if (!finalM3u8Url) {
      return NextResponse.json(
        { success: false, error: "No stream URL found in player response" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      from_db: fromDb,
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
    });
  } catch (err: any) {
    console.error("ShowBox/FebBox API Error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
