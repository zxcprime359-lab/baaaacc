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

    const m3u8Url = data.stream.playlist;
    const urlObj = new URL(m3u8Url);
    const proxyPath = urlObj.pathname;
    const searchParams = new URLSearchParams(urlObj.search.slice(1));
    const search = searchParams.toString() ? `?${searchParams.toString()}` : "";

    const proxyLinks = [
      "https://blue-star-dd7b.jinluxuz.workers.dev",
      "https://orange-poetry-e481.jindaedalus2.workers.dev",
    ];

    const proxyUrls = proxyLinks.map((p) => `${p}${proxyPath}${search}`);
    const workingProxy = await getWorkingProxy(proxyUrls);

    if (!workingProxy) {
      return NextResponse.json(
        { success: false, error: "All proxies down" },
        { status: 503 },
      );
    }

    return NextResponse.json({ success: 200, link: workingProxy, type: "hls" });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

async function getWorkingProxy(urls: string[]) {
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url, { method: "GET" }, 3000);
      console.log("Proxy check:", url, res.status);
      if (res.ok) return url;
    } catch (e) {
      console.log("Proxy failed:", url, e);
    }
  }
  return null;
}
