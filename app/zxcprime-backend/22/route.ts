import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";

async function fetchShareLinkFromSearch(
  title: string,
  year: string,
): Promise<string | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://zxcprime.site";

    const res = await fetchWithTimeout(
      `${baseUrl}/zxcprime-backend/search`,
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
    for (const result of (data?.results ?? []) as { url: string }[]) {
      const match = result.url.match(/febbox\.com\/share\/([A-Za-z0-9_-]+)/);
      if (match) return `https://www.febbox.com/share/${match[1]}`;
    }

    return null;
  } catch (err: any) {
    console.warn("Search engine error:", err.message);
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const tmdbId = searchParams.get("a");
    const mediaType = searchParams.get("b");
    const title = searchParams.get("f");
    const year = searchParams.get("g");
    const ts = Number(searchParams.get("gago"));
    const token = searchParams.get("putanginamo")!;
    const f_token = searchParams.get("f_token")!;

    if (!tmdbId || !mediaType || !title || !year || !ts || !token)
      return NextResponse.json(
        { success: false, error: "Missing params" },
        { status: 400 },
      );

    if (Date.now() - ts > 8000)
      return NextResponse.json(
        { success: false, error: "Token expired" },
        { status: 403 },
      );

    if (!validateBackendToken(tmdbId, f_token, ts, token))
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 403 },
      );

    const referer = req.headers.get("referer") ?? "";
    const allowed = [
      "/api/",
      "localhost",
      "192.168.1.4:3000",
      "zxcstream.xyz",
      "zxcprime.site",
    ];
    if (!allowed.some((h) => referer.includes(h)))
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );

    const shareLink = await fetchShareLinkFromSearch(title, year);

    if (!shareLink)
      return NextResponse.json(
        { success: false, error: "No FebBox share link found" },
        { status: 502 },
      );

    return NextResponse.json({ success: true, link: shareLink });
  } catch (err: any) {
    console.error("API Error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
