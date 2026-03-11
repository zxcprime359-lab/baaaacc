// import { NextRequest, NextResponse } from "next/server";
// import crypto from "crypto";

// const SECRET = process.env.API_SECRET || "supersecret123";

// function validateFrontendToken(f_token: string, id: string, ts: number) {
//   const expected = crypto
//     .createHash("sha256")
//     .update(`${id}:${ts}`)
//     .digest("hex");
//   return expected === f_token && Date.now() - ts < 5000;
// }

// function generateBackendToken(f_token: string, id: string) {
//   const ts = Date.now();
//   const token = crypto
//     .createHmac("sha256", SECRET)
//     .update(`${id}:${f_token}:${ts}`)
//     .digest("hex");
//   return { token, ts };
// }

// export async function POST(req: NextRequest) {
//   const { id, f_token, ts } = await req.json();

//   if (!validateFrontendToken(f_token, id, ts)) {
//     return NextResponse.json(
//       { error: "Invalid frontend token" },
//       { status: 403 }
//     );
//   }

//   const b_token = generateBackendToken(f_token, id);
//   return NextResponse.json(b_token);
// }
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const SECRET = process.env.API_SECRET || "supersecret123";

function validateFrontendToken(f_token: string, id: string, ts: number) {
  const expected = crypto
    .createHash("sha256")
    .update(`${id}:${ts}`)
    .digest("hex");
  return expected === f_token && Date.now() - ts < 5000;
}

function generateBackendToken(f_token: string, id: string) {
  const ts = Date.now();
  const token = crypto
    .createHmac("sha256", SECRET)
    .update(`${id}:${f_token}:${ts}`)
    .digest("hex");
  return { token, ts };
}
const blockedIPs = ["45.86.86.43"];

export async function POST(req: NextRequest) {
  const { idd, f_token, ts } = await req.json();
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0] || "Unknown";
  const connectingIp = req.headers.get("cf-connecting-ip");
  const ua = req.headers.get("user-agent") || "unknown";

  const origin = req.headers.get("origin") || "";
  const allowedOrigins = [
    "http://localhost:3000",
    "http://192.168.1.4:3000",
    "https://www.zxcstream.xyz",
    "https://zxcstream.xyz",
  ];
  console.log("TOKEN HIT", { connectingIp, ip, ua, origin });
  if (!allowedOrigins.includes(origin)) {
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }

  if (blockedIPs.includes(ip)) {
    console.log("Blocked IP tried to access:", ip, ua);
    return new Response(null, { status: 403 });
  }

  if (!validateFrontendToken(f_token, idd, ts)) {
    return NextResponse.json(
      { error: "Blocked IP tried to access:" },
      { status: 422 },
    );
  }

  const b_token = generateBackendToken(f_token, idd);
  return NextResponse.json(b_token);
}
