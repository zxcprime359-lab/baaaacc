import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("a");
    const media_type = req.nextUrl.searchParams.get("b");
    const season = req.nextUrl.searchParams.get("c");
    const episode = req.nextUrl.searchParams.get("d");
    const imdbId = req.nextUrl.searchParams.get("e");
    const ts = Number(req.nextUrl.searchParams.get("gago"));
    const token = req.nextUrl.searchParams.get("putangnamo")!;

    const f_token = req.nextUrl.searchParams.get("f_token")!;
    if (!id || !media_type || !ts || !token) {
      return NextResponse.json(
        { success: false, error: "need token" },
        { status: 404 },
      );
    }

    // ⏱ expire after 8 seconds
    if (Date.now() - Number(ts) > 8000) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 403 },
      );
    }
    if (!validateBackendToken(id, f_token, ts, token)) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 403 },
      );
    }

    // block direct /api access
    const referer = req.headers.get("referer") || "";
    if (
      !referer.includes("/api/") &&
      !referer.includes("localhost") &&
      !referer.includes("http://192.168.1.4:3000/") &&
      !referer.includes("https://www.zxcstream.xyz/")
    ) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const upstreamM3u8 =
      media_type === "tv"
        ? `https://scrennnifu.click/serial/${imdbId}/${season}/${episode}/playlist.m3u8`
        : `https://scrennnifu.click/movie/${imdbId}/playlist.m3u8`;

    try {
      const upstream = await fetchWithTimeout(
        upstreamM3u8,
        {
          headers: {
            Referer: "https://screenify.fun/",
            Origin: "https://screenify.fun/",
            "User-Agent": "Mozilla/5.0",
            Accept: "*/*",
          },
          cache: "no-store",
        },
        12000, // 5-second timeout
      );

      if (!upstream.ok) {
        return NextResponse.json(
          { success: false, error: `${upstream.status}` },
          { status: 502 },
        );
      }
    } catch (err) {
      return NextResponse.json(
        { success: false, error: "Timed out" },
        { status: 504 },
      );
    }

    const sourceLink = `/api/zxc?id=${media_type}-${imdbId}${
      media_type === "tv" ? `-${season}-${episode}` : ""
    }`;
    return NextResponse.json({
      success: true,
      link: sourceLink,
      type: "hls",
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
