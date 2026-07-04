import { CategoriesManager } from "@/components/dashboard/categories-manager";
import { listCategories } from "@/lib/services/products";

export default async function CategoriesPage() {
  const categories = await listCategories();

  return <CategoriesManager initialCategories={categories} />;
}
