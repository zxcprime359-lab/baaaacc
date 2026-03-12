import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type"); // movie or tv
  const id = req.nextUrl.searchParams.get("id");
  const season = req.nextUrl.searchParams.get("season");
  const episode = req.nextUrl.searchParams.get("episode");
  // block direct /api access
  const referer = req.headers.get("referer") || "";
  if (
    !referer.includes("/api/") &&
    !referer.includes("localhost") &&
    !referer.includes("https://www.zxcstream.xyz/")
  ) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  if (!type || !id) {
    return NextResponse.json({ error: ":3" }, { status: 400 });
  }

  // Build dynamic wplay URL
  let url = "";

  if (type === "movie") {
    url = `https://embed.wplay.me/r/movie/${id}?site=2&type=1`;
    // https://embed.wplay.me/r/movie/${id}?site=2&type=1
    // url = `https://play.xpass.top/e/movie/${id}?site=2&type=1`;
  } else if (type === "tv") {
    if (!season || !episode) {
      return NextResponse.json(
        { error: "TV type requires season and episode" },
        { status: 400 }
      );
    }
    url = `https://embed.wplay.me/r/tv/${id}/${season}/${episode}?site=2&type=1`;
  } else {
    return NextResponse.json(
      { error: "Invalid type: must be movie or tv" },
      { status: 400 }
    );
  }

  // Redirect to the wplay URL
  return NextResponse.redirect(url);
}
