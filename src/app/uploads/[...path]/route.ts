import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const filePath = join(process.cwd(), "public", "uploads", ...params.path);
    const file = await readFile(filePath);
    
    const ext = params.path[params.path.length - 1].split(".").pop();
    const contentType = ext === "png" ? "image/png" 
      : ext === "jpg" || ext === "jpeg" ? "image/jpeg"
      : ext === "pdf" ? "application/pdf"
      : "application/octet-stream";

    return new NextResponse(file, {
      headers: { "Content-Type": contentType },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}