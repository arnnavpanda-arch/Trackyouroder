import { useMemo } from 'react';
import { encodeCode128 } from '../utils/barcode';
import { generateQRMatrix } from '../utils/qrCode';

export function BarcodeView({
  value,
  height = 44,
  barWidth = 1.6,
  quietZone = 8,
  showText = true,
  className = '',
  style = {},
}) {
  const modules = useMemo(() => {
    if (!value) return [];
    return encodeCode128(value);
  }, [value]);

  if (!modules || modules.length === 0) return null;

  const svgWidth = modules.length * barWidth + quietZone * 2;
  const svgHeight = height + (showText ? 15 : 0);

  const rects = [];
  let currentStart = null;

  for (let i = 0; i < modules.length; i++) {
    if (modules[i] === 1) {
      if (currentStart === null) currentStart = i;
    } else {
      if (currentStart !== null) {
        rects.push({
          x: quietZone + currentStart * barWidth,
          width: (i - currentStart) * barWidth,
        });
        currentStart = null;
      }
    }
  }

  if (currentStart !== null) {
    rects.push({
      x: quietZone + currentStart * barWidth,
      width: (modules.length - currentStart) * barWidth,
    });
  }

  return (
    <div
      className={`barcode-wrapper ${className}`}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
        padding: '4px 6px',
        ...style,
      }}
    >
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ display: 'block' }}
        shapeRendering="crispEdges"
      >
        <rect width={svgWidth} height={svgHeight} fill="#ffffff" />
        {rects.map((r, idx) => (
          <rect key={idx} x={r.x} y={2} width={r.width} height={height} fill="#000000" />
        ))}
        {showText && (
          <text
            x={svgWidth / 2}
            y={height + 12}
            textAnchor="middle"
            fill="#000000"
            fontSize="10"
            fontWeight="bold"
            fontFamily="'Courier New', Courier, monospace"
            letterSpacing="1"
          >
            *{value}*
          </text>
        )}
      </svg>
    </div>
  );
}

export function QRCodeView({
  value,
  size = 220,
  logoSrc = '/phonepe.svg',
  logoSize = 36,
  style = {},
  className = '',
}) {
  const matrix = useMemo(() => {
    if (!value) return null;
    return generateQRMatrix(value);
  }, [value]);

  if (!matrix || matrix.length === 0) {
    return (
      <div
        className={`qr-placeholder ${className}`}
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          border: '1px dashed #cbd5e1',
          borderRadius: 16,
          color: '#64748b',
          fontSize: 12,
          ...style,
        }}
      >
        Generating QR Code…
      </div>
    );
  }

  const moduleCount = matrix.length;
  const padding = 3;
  const viewBoxSize = moduleCount + padding * 2;

  let path = '';
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (matrix[r][c]) {
        const isCenter =
          logoSrc &&
          r >= moduleCount / 2 - 3 &&
          r <= moduleCount / 2 + 2 &&
          c >= moduleCount / 2 - 3 &&
          c <= moduleCount / 2 + 2;

        if (!isCenter) {
          path += `M${c + padding},${r + padding}h1v1h-1z `;
        }
      }
    }
  }

  return (
    <div
      className={`qr-code-wrapper ${className}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
        padding: 12,
        borderRadius: 16,
        boxShadow: '0 4px 20px -2px rgba(95, 37, 159, 0.12), 0 2px 6px -1px rgba(0,0,0,0.06)',
        border: '1px solid #e9d5ff',
        ...style,
      }}
    >
      <svg
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        width={size}
        height={size}
        style={{ display: 'block' }}
        shapeRendering="crispEdges"
      >
        <rect width={viewBoxSize} height={viewBoxSize} fill="#ffffff" rx={2} />
        <path d={path} fill="#1e1b4b" />
      </svg>

      {logoSrc && (
        <div
          style={{
            position: 'absolute',
            width: logoSize,
            height: logoSize,
            background: '#ffffff',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
            border: '2px solid #ffffff',
            overflow: 'hidden',
          }}
        >
          <img src={logoSrc} alt="Logo" style={{ width: '85%', height: '85%', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  );
}

export default QRCodeView;
