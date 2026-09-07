import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
            width: 210,
            height: 320,
            background: "#edf1e6",
            border: "10px solid #22271d",
            borderRadius: 28,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ height: 138, borderBottom: "10px solid #22271d", width: "100%" }} />
          <div style={{ flex: 1, width: "100%" }} />
          <div
            style={{
              position: "absolute",
              left: 150,
              top: 128,
              width: 26,
              height: 26,
              borderRadius: 13,
              background: "#3c7a54",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}