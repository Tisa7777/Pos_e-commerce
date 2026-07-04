import { notFound } from "next/navigation";
import { ProductForm } from "@/components/forms/product-form";
import { PageHeader } from "@/components/ui/page-header";
import {
  getProductById,
  listCategories,
  listSuppliers,
} from "@/lib/services/products";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, categories, suppliers] = await Promise.all([
    getProductById(id),
    listCategories(),
    listSuppliers(),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalog"
        title="Edit product"
        description="Update catalog details, stock settings, publishing status, and product media."
      />
      <ProductForm
        categories={categories}
        suppliers={suppliers}
        product={product}
      />
    </div>
  );
}
