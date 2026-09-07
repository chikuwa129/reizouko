import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#22271d",
        }}
      >
        <div
          style={{
            position: "relative",
            width: 74,
            height: 112,
            background: "#edf1e6",
            border: "4px solid #22271d",
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ height: 48, borderBottom: "4px solid #22271d", width: "100%" }} />
          <div style={{ flex: 1, width: "100%" }} />
          <div
            style={{
              position: "absolute",
              left: 53,
              top: 45,
              width: 9,
              height: 9,
              borderRadius: 5,
              background: "#3c7a54",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}