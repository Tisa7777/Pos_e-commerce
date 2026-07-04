import Link from "next/link";
import { updateProductStatusFormAction } from "@/app/actions/products";
import { Button } from "@/components/ui/button";

export function ProductRowActions({
  productId,
  productSlug,
  isActive,
}: {
  productId: string;
  productSlug: string;
  isActive: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {isActive ? (
        <Button asChild variant="ghost" size="sm">
          <Link href={`/shop/${productSlug}`}>View</Link>
        </Button>
      ) : null}
      <Button asChild variant="ghost" size="sm">
        <Link href={`/admin/products/${productId}/edit`}>Edit</Link>
      </Button>
      <form action={updateProductStatusFormAction}>
        <input type="hidden" name="id" value={productId} />
        <input type="hidden" name="isActive" value={String(!isActive)} />
        <Button
          type="submit"
          variant={isActive ? "danger" : "primary"}
          size="sm"
        >
          {isActive ? "Deactivate" : "Activate"}
        </Button>
      </form>
    </div>
  );
}
