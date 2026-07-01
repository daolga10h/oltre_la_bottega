import { ImageResponse } from "next/og"

export const size = { width: 32, height: 32 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 7,
          background: "#261b07",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#f9a600",
          fontSize: 15,
          fontWeight: 700,
          fontFamily: "sans-serif",
          letterSpacing: -0.5,
        }}
      >
        OB
      </div>
    ),
    size
  )
}
