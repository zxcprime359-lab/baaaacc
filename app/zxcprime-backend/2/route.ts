import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";

export async function GET(req: NextRequest) {
  try {
    const tmdbId = req.nextUrl.searchParams.get("a");
    const mediaType = req.nextUrl.searchParams.get("b");
    const season = req.nextUrl.searchParams.get("c");
    const episode = req.nextUrl.searchParams.get("d");
    const title = req.nextUrl.searchParams.get("f");
    const year = req.nextUrl.searchParams.get("g");
    const ts = Number(req.nextUrl.searchParams.get("gago"));
    const token = req.nextUrl.searchParams.get("putangnamo")!;

    const f_token = req.nextUrl.searchParams.get("f_token")!;
    if (!tmdbId || !mediaType || !title || !year || !ts || !token) {
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
    if (!validateBackendToken(tmdbId, f_token, ts, token)) {
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
    const qs = new URLSearchParams();
    qs.set("title", title);
    qs.set("mediaType", mediaType);
    qs.set("year", year);
    qs.set("tmdbId", tmdbId);
    if (mediaType === "tv" && season) qs.set("seasonId", season);
    if (mediaType === "tv" && episode) qs.set("episodeId", episode);

    const pathLink = `https://api.videasy.net/cdn/sources-with-title?${qs}`;

    const pathLinkResponse = await fetchWithTimeout(
      `https://orange-poetry-e481.jindaedalus2.workers.dev/?url=${encodeURIComponent(pathLink)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
          Referer: "https://videasy.net/",
        },
      },
      5000,
    );
    if (!pathLinkResponse.ok) {
      const txt = await pathLinkResponse.text();
      console.error("videasy status:", pathLinkResponse.status);
      console.error("videasy body:", txt.slice(0, 300));

      return NextResponse.json(
        {
          success: false,
          error: "pathLinkResponse Upstream request failed",
          status: pathLinkResponse.status,
          body: txt.slice(0, 200),
        },
        { status: pathLinkResponse.status },
      );
    }

    const encrypted = await pathLinkResponse.text();

    const decrypted = await fetchWithTimeout(
      "https://enc-dec.app/api/dec-videasy",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: encrypted, id: String(tmdbId) }),
      },
      8000,
    );
    if (!decrypted.ok) {
      return NextResponse.json(
        { success: false, error: "Upstream request failed" },
        { status: decrypted.status },
      );
    }

    const decryptedData = await decrypted.json();

    const sources = decryptedData.result.sources;
    console.log("sourcessourcessources", sources);
    if (!Array.isArray(sources) || sources.length === 0) {
      return NextResponse.json(
        { success: false, error: "No m3u8 stream found" },
        { status: 404 },
      );
    }
    // Prefer "4K" or "4K HDR", fallback to "1080P" or "1080P HDR"
    const finalM3u8 =
      sources.find((s) => s.quality.includes("4K")) ??
      sources.find((s) => s.quality.includes("1080P HDR")) ??
      sources.find((s) => s.quality.includes("1080P"));

    if (!finalM3u8) {
      return NextResponse.json(
        { success: false, error: "No high-quality stream found" },
        { status: 404 },
      );
    }
    const finalM3u8Url = finalM3u8.url;
    const proxies = [
      "https://square-darkness-1efb.amenohabakiri174.workers.dev/",

      "https://morning-unit-723b.jinluxus303.workers.dev/",
      "https://damp-bird-f3a9.jerometecsonn.workers.dev/",
      "https://billowing-king-b723.jerometecson33.workers.dev/",

      "https://snowy-recipe-f96e.jerometecson000.workers.dev/",
    ];

    const workingProxy = await getWorkingProxy(finalM3u8Url, proxies);
    if (!workingProxy) {
      return NextResponse.json(
        { success: false, error: "No working proxy available" },
        { status: 502 },
      );
    }
    const proxiedUrl = `${workingProxy}?m3u8-proxy=${finalM3u8Url}`;
    return NextResponse.json({
      success: 200,
      link: proxiedUrl,
      type: "hls",
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
export async function getWorkingProxy(url: string, proxies: string[]) {
  for (const proxy of proxies) {
    try {
      const testUrl = `${proxy}?m3u8-proxy=${encodeURIComponent(url)}`;
      const res = await fetchWithTimeout(
        testUrl,
        { method: "GET", headers: { Range: "bytes=0-1" } },
        5000,
      );
      if (res.ok) return proxy;
    } catch (e) {
      console.log("Proxy failed:", proxy, e);
      // ignore and try next
    }
  }
  return null;
}
