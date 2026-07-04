import { ProductRowActions } from "@/components/dashboard/product-row-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  getDrinkSizePrice,
  isDrinkProduct,
  isStockTrackedProduct,
} from "@/lib/catalog/drink-sizes";
import { listProducts } from "@/lib/services/products";
import { formatCurrency } from "@/lib/utils";

export default async function AdminProductsPage() {
  const products = await listProducts({
    includeInactive: true,
    includeArchived: true,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description="Create, search, and monitor products shared by the storefront and the POS register."
        actionHref="/admin/products/new"
        actionLabel="New product"
      />
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
                            <Badge variant="soft" size="sm">M/L</Badge>
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
    </div>
  );
}
