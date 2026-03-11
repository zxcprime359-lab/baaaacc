import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { validateBackendToken } from "@/lib/token";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("a");
    const media_type = req.nextUrl.searchParams.get("b");
    const season = req.nextUrl.searchParams.get("c");
    const episode = req.nextUrl.searchParams.get("d");
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

    const sourceLink =
      media_type === "tv"
        ? `https://api.madplay.site/api/movies/holly?id=${id}&season=${season}&episode=${episode}&type=series`
        : `https://api.madplay.site/api/movies/holly?id=${id}&type=movie`;

    // const res = await fetch(sourceLink, {
    //   headers: {
    //     "User-Agent": "Mozilla/5.0",
    //     Referer: "https://uembed.xyz/",
    //   },
    // });

    const res = await fetchWithTimeout(
      sourceLink,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Referer: "https://uembed.xyz/",
        },
      },
      5000,
    ); // 5-second timeout

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: "Upstream request failed" },
        { status: res.status },
      );
    }

    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { success: false, error: "No m3u8 stream found" },
        { status: 404 },
      );
    }
    const firstSource = data.at(-1).file;
    const firstSourceType = data.at(-1).type;
    if (!firstSource)
      return NextResponse.json(
        { success: false, error: "No stream found" },
        { status: 404 },
      );

    return NextResponse.json({
      success: true,
      link: firstSource,
      type: firstSourceType,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
