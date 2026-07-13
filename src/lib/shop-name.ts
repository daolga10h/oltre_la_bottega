import type { User } from "@supabase/supabase-js"

export function getShopName(user: User | null): string {
  if (!user?.user_metadata?.shop_name) return "OB"
  const name = user.user_metadata.shop_name as string
  return name.trim() || "OB"
}

export function getPostLoginRedirect(user: User | null): string {
  return getShopName(user) === "OB" ? "/auth/setup-shop" : "/dashboard"
}
