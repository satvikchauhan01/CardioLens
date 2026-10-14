// Small line icons, drawn here so that no icon package is needed. Always decorative: the text
// next to an icon carries the meaning.

const PATHS = {
  home: ["M3 11.5 12 4l9 7.5", "M5.5 10v9.5h13V10", "M10 19.5v-5h4v5"],
  patients: [
    "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
    "M2.5 20c.4-3.6 3-5.5 6.5-5.5s6.1 1.9 6.5 5.5",
    "M16 4.3a3.5 3.5 0 0 1 0 6.4",
    "M18.5 14.8c1.7.8 2.7 2.5 3 5.2",
  ],
  new: [
    "M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
    "M3.5 20c.4-3.6 3-5.5 6.5-5.5 1.3 0 2.5.3 3.5.8",
    "M18.5 13.5v7",
    "M15 17h7",
  ],
  analysis: ["M2.5 12.5h4l2.2-6 3.6 12 2.6-8 1.4 2h5.2"],
  method: ["M4 20V10", "M10 20V4", "M16 20v-7", "M21 20H3"],
  sun: [
    "M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z",
    "M12 2.5v2",
    "M12 19.5v2",
    "M2.5 12h2",
    "M19.5 12h2",
    "M5.3 5.3l1.4 1.4",
    "M17.3 17.3l1.4 1.4",
    "M5.3 18.7l1.4-1.4",
    "M17.3 6.7l1.4-1.4",
  ],
  moon: ["M20 14.2A8.3 8.3 0 0 1 9.8 4 8.3 8.3 0 1 0 20 14.2Z"],
  tour: ["M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19Z", "m15.8 8.2-2 5.6-5.6 2 2-5.6 5.6-2Z"],
  reset: ["M4 12a8 8 0 1 0 2.6-5.9", "M4 4.5v4h4"],
  arrow: ["M5 12h14", "m13 6 6 6-6 6"],
  rotate: ["M20 12a8 8 0 1 1-2.6-5.9", "M20 4.5v4h-4"],
  heart: ["M12 20.5S3.5 15.6 3.5 9.4A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 8.5 1.8c0 6.2-8.5 11.1-8.5 11.1Z"],
  models: ["M12 3 3.5 7.5 12 12l8.5-4.5L12 3Z", "m3.5 12 8.5 4.5 8.5-4.5", "m3.5 16.5 8.5 4.5 8.5-4.5"],
  inputs: ["M4 6h10", "M18 6h2", "M4 12h3", "M11 12h9", "M4 18h12", "M20 18h0", "M16 4v4", "M9 10v4", "M18 16v4"],
  shield: ["M12 3 4.5 6v5.5c0 4.6 3.1 8.1 7.5 9.5 4.4-1.4 7.5-4.9 7.5-9.5V6L12 3Z", "m9 12 2.2 2.2L15.2 10"],
  database: [
    "M12 9c4.1 0 7.5-1.3 7.5-3S16.1 3 12 3 4.5 4.3 4.5 6s3.4 3 7.5 3Z",
    "M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6",
    "M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6",
  ],
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  className?: string; // size and colour; the icon is drawn with the text colour
}

export function Icon({ name, className = "size-4" }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
