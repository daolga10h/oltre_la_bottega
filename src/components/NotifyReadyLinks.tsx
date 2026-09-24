"use client"

import { useRouter } from "next/navigation"
import { MessageCircle, Mail } from "lucide-react"
import { QuickContactLink } from "@/components/QuickContactLink"
import { WhatsAppQr } from "@/components/WhatsAppQr"
import { markMsgProntoInviato } from "@/actions/orders"

interface NotifyReadyLinksProps {
  orderId: string
  waLink: string | null
  mailLink: string | null
}

export function NotifyReadyLinks({ orderId, waLink, mailLink }: NotifyReadyLinksProps) {
  const router = useRouter()

  function handleClick() {
    markMsgProntoInviato(orderId).then(() => router.refresh())
  }

  return (
    <>
      <QuickContactLink href={waLink} icon={MessageCircle} label="WhatsApp" external variant="toolbar" onClick={handleClick} />
      <QuickContactLink href={mailLink} icon={Mail} label="Email" variant="toolbar" onClick={handleClick} />
      <WhatsAppQr waLink={waLink} onDone={handleClick} />
    </>
  )
}
