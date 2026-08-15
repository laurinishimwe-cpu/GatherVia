import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const sourceUrl = request.nextUrl.searchParams.get("url");

  if (!sourceUrl) {
    return new NextResponse("Missing image URL", { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    return new NextResponse("Invalid image URL", { status: 400 });
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return new NextResponse("Unsupported image URL", { status: 400 });
  }

  const response = await fetch(parsedUrl, { cache: "no-store" });
  if (!response.ok) {
    return new NextResponse("Image could not be loaded", { status: response.status });
  }

  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  if (!contentType.startsWith("image/")) {
    return new NextResponse("URL is not an image", { status: 415 });
  }

  return new NextResponse(response.body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": contentType,
    },
  });
}
