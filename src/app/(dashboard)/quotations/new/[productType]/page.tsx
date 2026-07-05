import { redirect, notFound } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getConfigTypes, getPricingFactors } from "../../../../../../lib/pricing/actions";
import { ProductRecipeForm } from "../_components/product-recipe-form";

const VALID_PRODUCT_TYPES = [
  "SHOWER",
  "HANDR_STRAIGHT",
  "HANDR_INCLINED",
  "CLADDING",
  "LAMINATED",
  "GLASS_CEILING",
  "GLASS_FLOOR",
  "FACADE_MODULAR",
  "FACADE_SPIDER",
] as const;

export default async function NewProductQuotationPage(props: {
  params: Promise<{ productType: string }>;
}) {
  const { productType: productTypeCode } = await props.params;

  if (!VALID_PRODUCT_TYPES.includes(productTypeCode as (typeof VALID_PRODUCT_TYPES)[number])) {
    notFound();
  }

  const roleCheck = await requireRole(["ADMIN", "SALES_MANAGER", "SALES_REP"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const productType = await prisma.productType.findUnique({
    where: { code: productTypeCode },
  });
  if (!productType) notFound();

  const [configTypes, pricingFactors] = await Promise.all([
    getConfigTypes(productType.id),
    getPricingFactors(),
  ]);

  return (
    <ProductRecipeForm
      productTypeCode={productType.code}
      title={productType.nameAr}
      configTypes={configTypes.map((c) => ({ id: c.id, nameAr: c.nameAr }))}
      pricingFactors={pricingFactors.map((f) => ({
        id: f.id,
        label: f.label,
        value: f.value.toNumber(),
      }))}
    />
  );
}
