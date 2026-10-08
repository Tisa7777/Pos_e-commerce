"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import {
  deleteProductFormAction,
  updateProductStatusFormAction,
} from "@/app/actions/products";
import { Button } from "@/components/ui/button";

export function ProductRowActions({
  productId,
  productName,
  productSlug,
  isActive,
}: {
  productId: string;
  productName: string;
  productSlug: string;
  isActive: boolean;
}) {
  function confirmDelete(event: FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      `Delete ${productName}? This removes it from the product list, storefront, and POS register.`,
    );

    if (!confirmed) {
      event.preventDefault();
    }
  }

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
      <form action={deleteProductFormAction} onSubmit={confirmDelete}>
        <input type="hidden" name="id" value={productId} />
        <Button type="submit" variant="danger" size="sm">
          Delete
        </Button>
      </form>
    </div>
  );
}
