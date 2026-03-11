import { encodeBase64Url } from "@/lib/base64";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/token";

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
      !referer.includes("http://192.168.1.6:3000/") &&
      !referer.includes("https://www.zxcstream.xyz/")
    ) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const pathLink = `https://enc-dec.app/api/enc-vidlink?text=${id}`;

    const pathLinkResponse = await fetchWithTimeout(
      pathLink,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Referer: "https://vidlink.pro/",
        },
      },
      5000,
    );

    const pathLinkData = await pathLinkResponse.json();

    const sourceLink =
      media_type === "tv"
        ? `https://vidlink.pro/api/b/tv/${pathLinkData.result}/${season}/${episode}`
        : `https://vidlink.pro/api/b/movie/${pathLinkData.result}`;

    const res = await fetchWithTimeout(
      sourceLink,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Referer: "https://vidlink.pro/",
        },
      },
      8000,
    );

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: "Upstream request failed" },
        { status: res.status },
      );
    }

    const data = await res.json();

    if (!data.stream.playlist) {
      return NextResponse.json(
        { success: false, error: "No sources found" },
        { status: 404 },
      );
    }

    const m3u8Url = data.stream.playlist; // e.g. https://storm.vodvidl.site/proxy/file2/.../playlist.m3u8?...

    // Extract only the pathname (everything starting from /proxy/...)
    const urlObj = new URL(m3u8Url);
    const proxyPath = urlObj.pathname; // → /proxy/file2/.../playlist.m3u8

    // Optional: preserve query params if needed (e.g. host=), but we don't need headers anymore
    const search = urlObj.search; // usually has ?headers=...&host=...

    //proxy links
    //https://damp-bonus-5625.mosangfour.workers.dev/
    //https://square-darkness-1efb.amenohabakiri174.workers.dev/
    //https://orange-poetry-e481.jindaedalus2.workers.dev/
    //https://long-frog-ec4e.coupdegrace21799.workers.dev/
    //https://morning-unit-723b.jinluxus303.workers.dev/
    //https://dark-scene-567a.jinluxuz.workers.dev/

    const proxyLinks = [
      `https://blue-hat-477a.jerometecson333.workers.dev`,

      `https://square-darkness-1efb.amenohabakiri174.workers.dev`,
      `https://orange-poetry-e481.jindaedalus2.workers.dev`,
      `https://long-frog-ec4e.coupdegrace21799.workers.dev`,

      `https://dark-scene-567a.jinluxuz.workers.dev`,
    ];

    let finalProxy: string | null = null;
    for (const proxy of proxyLinks) {
      const testUrl = `${proxy}${proxyPath}${search}`;
      try {
        const head = await fetch(testUrl, {
          method: "HEAD",
          signal: AbortSignal.timeout(1500),
        });
        if (head.ok) {
          finalProxy = testUrl;
          break;
        }
      } catch {
        // try next proxy
      }
    }
    if (!finalProxy) {
      return NextResponse.json(
        { success: false, error: "All proxies down" },
        { status: 503 },
      );
    }

    return NextResponse.json({
      success: 200,
      link: finalProxy,
      type: "hls",
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
