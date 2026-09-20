import { getPostLoginRedirect } from "@/lib/shop-name"
import type { User } from "@supabase/supabase-js"

function makeUser(shopName?: string): User {
  return {
    user_metadata: shopName ? { shop_name: shopName } : {},
  } as User
}

describe("getPostLoginRedirect", () => {
  it("returns /setup-shop when shop name is not set", () => {
    expect(getPostLoginRedirect(makeUser())).toBe("/setup-shop")
  })

  it("returns /dashboard when shop name is already set", () => {
    expect(getPostLoginRedirect(makeUser("Bottega di Olga"))).toBe("/dashboard")
  })

  it("returns /setup-shop when user is null", () => {
    expect(getPostLoginRedirect(null)).toBe("/setup-shop")
  })
})