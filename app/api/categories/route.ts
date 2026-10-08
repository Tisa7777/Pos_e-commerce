import { NextResponse } from "next/server";
import { listCategories } from "@/lib/services/products";

export async function GET() {
  try {
    const categories = await listCategories();
    return NextResponse.json({ data: categories });
  } catch (error) {
    console.error("[GET /api/categories]", error);
    return NextResponse.json({ error: "Unable to load categories." }, { status: 500 });
  }
}
