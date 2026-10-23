import QRCode from "qrcode";

// A QR code drawn as SVG (on the server or in the browser), with plain square
// modules: an invoice's code has to scan in any app, including ZATCA's.

type Props = { value: string; className?: string; color?: string; label: string; quiet?: number };

export function Qr({ value, className, color = "#14172a", label, quiet = 2 }: Props) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const size = n + quiet * 2;
  // One path, one horizontal run per row segment: small markup, crisp edges.
  let d = "";
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!qr.modules.get(r, c)) {
        c++;
        continue;
      }
      const start = c;
      while (c < n && qr.modules.get(r, c)) c++;
      d += `M${start + quiet},${r + quiet}h${c - start}v1h${start - c}z`;
    }
  }
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="white" />
      <path d={d} fill={color} />
    </svg>
  );
}
