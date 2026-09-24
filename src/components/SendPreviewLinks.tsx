"use client"

import { useRouter } from "next/navigation"
import { MessageCircle, Mail } from "lucide-react"
import { QuickContactLink } from "@/components/QuickContactLink"
import { WhatsAppQr } from "@/components/WhatsAppQr"
import { updateBozzaGrafica } from "@/actions/orders"

interface SendPreviewLinksProps {
  orderId: string
  waLink: string | null
  mailLink: string | null
}

export function SendPreviewLinks({ orderId, waLink, mailLink }: SendPreviewLinksProps) {
  const router = useRouter()

  function handleClick() {
    updateBozzaGrafica(orderId, "inviata").then(() => router.refresh())
  }

  return (
    <>
      <QuickContactLink href={waLink} icon={MessageCircle} label="WhatsApp" external variant="toolbar" onClick={handleClick} />
      <QuickContactLink href={mailLink} icon={Mail} label="Email" variant="toolbar" onClick={handleClick} />
      <WhatsAppQr waLink={waLink} onDone={handleClick} />
    </>
  )
}
