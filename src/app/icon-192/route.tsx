import { ImageResponse } from "next/og"

export const contentType = "image/png"

const INTER_BLACK_URL =
  "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuDyYMZg.ttf"

export async function GET() {
  const fontData = await fetch(new URL(INTER_BLACK_URL)).then((res) => res.arrayBuffer())

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#3b2716",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#f2e4c9",
          fontSize: 88,
          fontWeight: 800,
          fontFamily: "Inter",
          letterSpacing: -2.5,
        }}
      >
        OB
      </div>
    ),
    {
      width: 192,
      height: 192,
      fonts: [{ name: "Inter", data: fontData, weight: 800, style: "normal" }],
    }
  )
}
