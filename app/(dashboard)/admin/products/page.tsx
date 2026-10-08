import Link from "next/link";
import { ProductRowActions } from "@/components/dashboard/product-row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  getDrinkSizePrice,
  isDrinkProduct,
  isStockTrackedProduct,
} from "@/lib/catalog/drink-sizes";
import { listCategories, listProducts } from "@/lib/services/products";
import { formatCurrency } from "@/lib/utils";

type ProductStatusFilter = "all" | "active" | "inactive";

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeStatus(value: string | undefined): ProductStatusFilter {
  return value === "active" || value === "inactive" ? value : "all";
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    category?: string | string[];
    status?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const searchTerm = readParam(params.q)?.trim() ?? "";
  const categorySlug = readParam(params.category)?.trim() ?? "";
  const status = normalizeStatus(readParam(params.status));

  const [matchingProducts, categories] = await Promise.all([
    listProducts({
      search: searchTerm || undefined,
      categorySlug: categorySlug || undefined,
      includeInactive: true,
    }),
    listCategories(),
  ]);
  const products = matchingProducts.filter((product) => {
    if (status === "active") {
      return product.isActive;
    }

    if (status === "inactive") {
      return !product.isActive;
    }

    return true;
  });
  const hasFilters = Boolean(searchTerm || categorySlug || status !== "all");
  const activeCategory = categories.find((category) => category.slug === categorySlug);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description="Search, edit, and remove products shared by the storefront and the POS register."
        actionHref="/admin/products/new"
        actionLabel="New product"
      />

      <Card>
        <CardContent className="space-y-4 p-4">
          <form
            action="/admin/products"
            className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px_auto_auto]"
          >
            <Input
              name="q"
              type="search"
              defaultValue={searchTerm}
              placeholder="Search product name, SKU, or barcode..."
              aria-label="Search products"
            />
            <Select name="category" defaultValue={categorySlug} aria-label="Filter by category">
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Select name="status" defaultValue={status} aria-label="Filter by status">
              <option value="all">All statuses</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </Select>
            <Button type="submit">Search</Button>
            {hasFilters ? (
              <Button asChild variant="ghost">
                <Link href="/admin/products">Clear</Link>
              </Button>
            ) : null}
          </form>

          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>
              Showing <strong className="text-slate-800">{products.length}</strong> product
              {products.length === 1 ? "" : "s"}
            </span>
            {searchTerm ? <Badge variant="soft">Search: {searchTerm}</Badge> : null}
            {activeCategory ? <Badge variant="soft">{activeCategory.name}</Badge> : null}
            {status !== "all" ? (
              <Badge variant={status === "active" ? "success" : "warning"}>
                {status === "active" ? "Active" : "Inactive"}
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {products.length > 0 ? (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH>Category</TH>
                  <TH>Price</TH>
                  <TH>Stock</TH>
                  <TH>Status</TH>
                  <TH>Actions</TH>
                </TR>
              </THead>
              <TBody>
                {products.map((product) => {
                  const hasDrinkSizes = isDrinkProduct(product);
                  const isStockTracked = isStockTrackedProduct(product);

                  return (
                    <TR key={product.id}>
                      <TD>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-950">{product.name}</p>
                            {hasDrinkSizes ? (
                              <Badge variant="soft" size="sm">
                                M/L
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            {product.sku}
                          </p>
                        </div>
                      </TD>
                      <TD>{product.category?.name ?? "Unassigned"}</TD>
                      <TD>
                        {hasDrinkSizes ? (
                          <div className="space-y-1 font-mono text-sm">
                            <p className="font-semibold text-slate-950">
                              M {formatCurrency(product.price)}
                            </p>
                            <p className="text-slate-500">
                              L {formatCurrency(getDrinkSizePrice(product.price, "L"))}
                            </p>
                          </div>
                        ) : (
                          formatCurrency(product.price)
                        )}
                      </TD>
                      <TD>
                        {isStockTracked ? (
                          product.stockQuantity
                        ) : (
                          <span className="text-sm text-slate-500">Not tracked</span>
                        )}
                      </TD>
                      <TD>
                        <Badge tone={product.isActive ? "success" : "warning"}>
                          {product.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TD>
                      <TD>
                        <ProductRowActions
                          productId={product.id}
                          productName={product.name}
                          productSlug={product.slug}
                          isActive={product.isActive}
                        />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title={hasFilters ? "No products match your search" : "No products yet"}
          description={
            hasFilters
              ? "Try a different product name, SKU, barcode, category, or status filter."
              : "Create your first product so it appears in the storefront and POS register."
          }
          actionHref={hasFilters ? undefined : "/admin/products/new"}
          actionLabel={hasFilters ? undefined : "New product"}
          secondaryAction={
            hasFilters ? (
              <Button asChild variant="ghost">
                <Link href="/admin/products">Clear search</Link>
              </Button>
            ) : undefined
          }
          iconName="package"
        />
      )}
    </div>
  );
}
