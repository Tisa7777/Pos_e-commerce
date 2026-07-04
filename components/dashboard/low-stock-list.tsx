import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProductCardData } from "@/types/domain";

export function LowStockList({ products }: { products: ProductCardData[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Low-stock watchlist</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {products.map((product) => (
          <div
            key={product.id}
            className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white/70 p-4"
          >
            <div>
              <p className="font-semibold text-slate-950">{product.name}</p>
              <p className="text-sm text-slate-500">
                SKU {product.sku} • Threshold {product.lowStockThreshold}
              </p>
            </div>
            <Badge tone={product.stockQuantity <= product.lowStockThreshold ? "danger" : "info"}>
              {product.stockQuantity} left
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
