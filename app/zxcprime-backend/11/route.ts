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

    // block direct /api access
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
    // -------- MovieBox Logic --------
    const randomIP =
      africanIPs[Math.floor(Math.random() * africanIPs.length)].ip;
    const host = "h5.aoneroom.com";

    //movieboxapp.in
    const baseUrl = `https://${host}`;
    const headers: Record<string, string> = {
      "X-Client-Info": '{"timezone":"Africa/Nairobi"}',
      "Accept-Language": "en-US,en;q=0.5",
      Accept: "application/json",
      "User-Agent": "okhttp/4.12.0",
      Referer:
        "https://fmoviesunblocked.net/spa/videoPlayPage/movies/the-housemaid-0salyuvbRw2?id=2123398053372510440&type=/movie/detail",
      "X-Forwarded-For": randomIP,
      "CF-Connecting-IP": randomIP,
      "X-Real-IP": randomIP,
      Origin: "https://fmoviesunblocked.net",
    };
    // Search for movie/TV show
    const searchRes = await fetch(
      `${baseUrl}/wefeed-h5-bff/web/subject/search`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: title,
          page: 1,
          perPage: 24,
          subjectType: mediaType === "tv" ? 2 : 1,
        }),
      },
    );

    const searchJson = await searchRes.json();
    const results = searchJson?.data?.data || searchJson?.data || searchJson;
    const items = results?.items || [];
    if (!items.length)
      return NextResponse.json(
        { success: false, error: "No search results" },
        { status: 404 },
      );
    // const normalizedSearch = title.trim().toLowerCase();

    // const selectedItem = items.find((i: any) => {
    //   const itemTitle = (i?.title || "").trim().toLowerCase();
    //   return itemTitle === normalizedSearch;
    // });

    // if (!selectedItem) {
    //   return NextResponse.json(
    //     { success: false, error: "Exact movie not found" },
    //     { status: 404 },
    //   );
    // }

    // const subjectId = String(selectedItem?.subjectId);
    // if (!subjectId)
    //   return NextResponse.json(
    //     { success: false, error: "subjectId not found" },
    //     { status: 404 },
    //   );

    const selectedItem =
      items.find((i: any) =>
        (i?.title || "").toLowerCase().includes(title.toLowerCase()),
      ) || items[0];
    const subjectId = String(selectedItem?.subjectId);
    if (!subjectId)
      return NextResponse.json(
        { success: false, error: "subjectId not found" },
        { status: 404 },
      );

    // Detail info
    const detailRes = await fetch(
      `${baseUrl}/wefeed-h5-bff/web/subject/detail?subjectId=${encodeURIComponent(subjectId)}`,
      { headers },
    );
    const detailJson = await detailRes.json();
    const info = detailJson?.data?.data || detailJson?.data || detailJson;
    const detailPath = info?.subject?.detailPath || "";

    // Download sources
    const params = new URLSearchParams({ subjectId });
    if (mediaType === "tv") {
      if (season) params.set("se", String(season));
      if (episode) params.set("ep", String(episode));
    }

    const sourcesRes = await fetch(
      `${baseUrl}/wefeed-h5-bff/web/subject/download?${params.toString()}`,
      {
        headers: {
          ...headers,
          Referer: `https://fmoviesunblocked.net/spa/videoPlayPage/movies/${detailPath}?id=${subjectId}&type=/movie/detail`,
          Origin: "https://fmoviesunblocked.net",
        },
      },
    );

    const sourcesJson = await sourcesRes.json();
    const sources = sourcesJson?.data?.data || sourcesJson?.data || sourcesJson;
    const downloads = sources?.downloads || [];
    if (!downloads.length)
      return NextResponse.json(
        { success: false, error: "No download sources" },
        { status: 404 },
      );

    // Pick highest resolution
    const sortedDownloads = downloads
      .filter((d: any) => d?.url && typeof d.url === "string")
      .sort((a: any, b: any) => (b.resolution || 0) - (a.resolution || 0));
    const videoUrl = sortedDownloads[0].url;

    const proxies = [
      "https://silent-glitter-744f.zxcprime365.workers.dev/",
      "https://nameless-feather-4fca.zxcprime364.workers.dev/",
      "https://sweet-dust-bdb3.vetenabejar.workers.dev/",
      "https://blue-hat-477a.jerometecson333.workers.dev/",
      "https://late-snowflake-5076.zxcprime362.workers.dev/",
      "https://empty-pond-805b.zxcprime363.workers.dev/",
      "https://orange-paper-a80d.j61202287.workers.dev/",
      "https://weathered-frost-60b0.zxcprime361.workers.dev/",
      "https://long-frog-ec4e.coupdegrace21799.workers.dev/",
      "https://damp-bird-f3a9.jerometecsonn.workers.dev/",
      "https://damp-bonus-5625.mosangfour.workers.dev/",
      "https://still-butterfly-9b3e.zxcprime360.workers.dev/",
    ];
    const workingProxy = await getWorkingProxy(videoUrl, proxies);

    if (!workingProxy) {
      console.log("No working proxy");
      return NextResponse.json(
        { success: false, error: "No working proxy available" },
        { status: 502 },
      );
    }
    const proxiedUrl = `${workingProxy}?url=${encodeURIComponent(videoUrl)}`;
    return NextResponse.json({
      success: true,
      link: proxiedUrl,
      type: videoUrl.includes(".m3u8") ? "hls" : "mp4",
      api_key: randomIP,
      // headers: {
      //   "User-Agent": "okhttp/4.12.0",
      //   Referer: "https://fmoviesunblocked.net/",
      //   Origin: "https://fmoviesunblocked.net",
      // },
    });
  } catch (err: any) {
    console.error("MovieBox API Error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
const africanIPs = [
  { ip: "41.90.65.134" },
  { ip: "41.204.187.92" },
  { ip: "41.215.122.41" },
  { ip: "102.89.23.176" },
  { ip: "102.134.77.58" },
  { ip: "197.210.54.119" },
  { ip: "197.211.96.44" },
  { ip: "105.5.88.201" },
  { ip: "105.14.201.73" },
  { ip: "196.33.214.88" },
  { ip: "196.25.1.142" },
  { ip: "154.160.44.93" },
  { ip: "154.160.120.18" },
  { ip: "41.78.64.55" },
  { ip: "41.222.188.91" },
  { ip: "105.158.32.177" },
  { ip: "197.230.145.66" },
];
export async function getWorkingProxy(url: string, proxies: string[]) {
  for (const proxy of proxies) {
    try {
      const testUrl = `${proxy}?url=${encodeURIComponent(url)}`;
      const res = await fetchWithTimeout(
        testUrl,
        {
          method: "HEAD",
          headers: {
            Range: "bytes=0-1",
          },
        },
        3000,
      );
      if (res.ok) return proxy;
    } catch (e) {}
  }
  return null;
}
