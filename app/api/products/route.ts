import { NextRequest, NextResponse } from "next/server";
import { listProducts } from "@/lib/services/products";
import { toPublicProduct } from "@/lib/api/products";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search")?.trim() ?? "";
  const categorySlug = searchParams.get("category")?.trim() ?? "";

  if (search.length > 100 || categorySlug.length > 100) {
    return NextResponse.json(
      { error: "Search and category must be 100 characters or fewer." },
      { status: 400 },
    );
  }

  try {
    const products = await listProducts({
      search: search || undefined,
      categorySlug: categorySlug || undefined,
    });
    return NextResponse.json({ data: products.map(toPublicProduct) });
  } catch (error) {
    console.error("[GET /api/products]", error);
    return NextResponse.json({ error: "Unable to load products." }, { status: 500 });
  }
}
