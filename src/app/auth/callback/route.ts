import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getShopName } from "@/lib/shop-name"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      const shopName = getShopName(user)
      const target = shopName === "OB" ? "/auth/setup-shop" : "/dashboard"
      return NextResponse.redirect(`${origin}${target}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
