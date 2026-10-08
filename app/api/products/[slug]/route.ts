import { NextResponse } from "next/server";
import { getProductBySlug } from "@/lib/services/products";
import { toPublicProduct } from "@/lib/api/products";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  if (!slug || slug.length > 150) {
    return NextResponse.json({ error: "Invalid product slug." }, { status: 400 });
  }

  try {
    const product = await getProductBySlug(slug);
    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    return NextResponse.json({ data: toPublicProduct(product) });
  } catch (error) {
    console.error("[GET /api/products/[slug]]", error);
    return NextResponse.json({ error: "Unable to load product." }, { status: 500 });
  }
}
