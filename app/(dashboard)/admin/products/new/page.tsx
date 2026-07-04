import { ProductForm } from "@/components/forms/product-form";
import { PageHeader } from "@/components/ui/page-header";
import { listCategories, listSuppliers } from "@/lib/services/products";

export default async function NewProductPage() {
  const [categories, suppliers] = await Promise.all([
    listCategories(),
    listSuppliers(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalog"
        title="Create product"
        description="The create flow uses a server action, typed validation, and optional Supabase Storage upload for the primary image."
      />
      <ProductForm categories={categories} suppliers={suppliers} />
    </div>
  );
}
