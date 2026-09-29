// Stroke icon set (1.5 px, 16 px grid). Inline so nothing is fetched.
const P = {
  snow: <><path d="M8 1.5v13M2.4 4.75l11.2 6.5M2.4 11.25l11.2-6.5" /><path d="M6.3 2.8 8 4.3l1.7-1.5M6.3 13.2 8 11.7l1.7 1.5" /></>,
  map: <><path d="M1.5 3.5 5.5 2l5 1.5 4-1.5v10.5l-4 1.5-5-1.5-4 1.5Z" /><path d="M5.5 2v10.5M10.5 3.5V14" /></>,
  cube: <><path d="M8 1.8 13.5 4.8v6.4L8 14.2 2.5 11.2V4.8Z" /><path d="M2.5 4.8 8 7.8l5.5-3M8 7.8v6.4" /></>,
  tent: <><path d="M1.5 13.5 8 2.5l6.5 11Z" /><path d="M8 2.5v11M6 13.5 8 9.5l2 4" /></>,
  drop: <path d="M8 2s4.5 5 4.5 8a4.5 4.5 0 0 1-9 0C3.5 7 8 2 8 2Z" />,
  path: <><path d="M2 13.5c3 0 2-5 6-5s3-5 6-5" strokeDasharray="2 1.5" /></>,
  dots: <><circle cx="4" cy="5" r="1" /><circle cx="9" cy="4" r="1" /><circle cx="12" cy="9" r="1" /><circle cx="6" cy="10" r="1" /><circle cx="10" cy="13" r="1" /></>,
  berm: <><path d="M1.5 12.5 5 7h6l3.5 5.5Z" /><path d="M1.5 12.5h13" /></>,
  clearing: <><rect x="2.5" y="2.5" width="11" height="11" strokeDasharray="2 1.6" /><path d="M6 8h4" /></>,
  play: <path d="M4.5 3v10l8-5Z" />,
  pause: <path d="M5 3v10M11 3v10" />,
  next: <path d="M3.5 3v10l6.5-5ZM12.5 3v10" />,
  profile: <><path d="M1.5 13.5 5 7l3 3 3.5-6 3 9.5Z" /></>,
  rect: <rect x="2.5" y="3.5" width="11" height="9" />,
  polygon: <path d="M8 2 14 6.5 11.5 14h-7L2 6.5Z" />,
  circle: <circle cx="8" cy="8" r="5.5" />,
  pointer: <path d="M3.5 2.5 12.5 8l-4 1-2 4.5Z" />,
  info: <><circle cx="8" cy="8" r="6" /><path d="M8 7.2V11.5M8 4.6v.3" /></>,
  mountain: <><path d="M1 13.5 6 5l3 5 2-3 4 6.5Z" /></>,
  slope: <><path d="M2 13.5h12L2 4Z" /><path d="M5 13.5a3 3 0 0 0-1-2.3" /></>,
  contour: <><path d="M2 11c2-3 4 1 6-2s4 0 6-3" /><path d="M2 14c2-3 4 1 6-2s4 0 6-3" /><path d="M2 8c2-3 4 1 6-2s4 0 6-3" /></>,
  river: <><path d="M4 1.5c3 3-2 5 1 8s3 3 0 5" /><path d="M9 1.5c3 3-2 5 1 8s3 3 0 5" /></>,
  pin: <><path d="M8 14.5V9" /><rect x="5" y="2" width="6" height="7" /></>,
  help: <><circle cx="8" cy="8" r="6" /><path d="M6.2 6.3A1.9 1.9 0 1 1 8 8.5v1.2M8 11.8v.3" /></>,
  funnel: <path d="M2 3h12l-4.5 5.5V13l-3 1.5v-6Z" />,
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  bell2: <><path d="M4 11V7a4 4 0 0 1 8 0v4l1.2 1.5H2.8L4 11Z" /><path d="M6.5 14h3M13 2.5l1.5-1M3 2.5 1.5 1.5" /></>,
  sun: <><circle cx="8" cy="8" r="3" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M13 3l-1.4 1.4M4.4 11.6 3 13" /></>,
  grid: <><path d="M1.5 5.5h13M1.5 10.5h13M5.5 1.5v13M10.5 1.5v13" /></>,
  arrowUp: <path d="M8 13V3M4 7l4-4 4 4" />,
  arrowDown: <path d="M8 3v10M4 9l4 4 4-4" />,
  expand: <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />,
  ask: <><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5 14 14" /></>,
  queue: <><path d="M2 3.5h12M2 8h12M2 12.5h8" /></>,
  sites: <><path d="M8 14s-4.5-4.2-4.5-7.5a4.5 4.5 0 0 1 9 0C12.5 9.8 8 14 8 14Z" /><circle cx="8" cy="6.5" r="1.5" /></>,
  watch: <><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" /><circle cx="8" cy="8" r="2" /></>,
  gaps: <><rect x="2" y="2" width="5" height="5" /><rect x="9" y="2" width="5" height="5" /><rect x="2" y="9" width="5" height="5" /><path d="M9 9h5v5H9z" strokeDasharray="1.5 1.5" /></>,
  handoff: <><path d="M3 8h9M9 4.5 12.5 8 9 11.5" /><path d="M2 2.5v11" /></>,
  audit: <><path d="M8 1.8 13 4v4c0 3-2.2 5.2-5 6.2C5.2 13.2 3 11 3 8V4l5-2.2Z" /><path d="m5.8 8 1.6 1.6L10.4 6.6" /></>,
  bell: <><path d="M4 11V7a4 4 0 0 1 8 0v4l1.2 1.5H2.8L4 11Z" /><path d="M6.5 14h3" /></>,
  copy: <><rect x="5" y="5" width="8.5" height="8.5" /><path d="M11 5V2.5H2.5V11H5" /></>,
  check: <path d="m3 8.5 3.2 3L13 4.5" />,
  x: <path d="M4 4l8 8M12 4l-8 8" />,
  plus: <path d="M8 3v10M3 8h10" />,
  chevron: <path d="m6 4 4 4-4 4" />,
  chevronDown: <path d="m4 6 4 4 4-4" />,
  layers: <><path d="M8 2 14 5 8 8 2 5 8 2Z" /><path d="m2 8 6 3 6-3M2 11l6 3 6-3" /></>,
  cloud: <path d="M4.5 12.5h7a3 3 0 0 0 .3-6A4 4 0 0 0 4 7a2.8 2.8 0 0 0 .5 5.5Z" />,
  radar: <><circle cx="8" cy="8" r="6" /><circle cx="8" cy="8" r="3" /><path d="M8 8 12.2 3.8" /></>,
  download: <><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5" /><path d="M2.5 13.5h11" /></>,
  file: <><path d="M4 1.8h5.5L12.5 5v9.2H4Z" /><path d="M9.5 1.8V5h3" /></>,
  link: <><path d="M7 9a2.5 2.5 0 0 0 3.5 0l2.3-2.3a2.5 2.5 0 0 0-3.5-3.5L8.5 4" /><path d="M9 7a2.5 2.5 0 0 0-3.5 0L3.2 9.3a2.5 2.5 0 0 0 3.5 3.5L7.5 12" /></>,
  target: <><circle cx="8" cy="8" r="5.5" /><path d="M8 1v3M8 12v3M1 8h3M12 8h3" /></>,
  flag: <><path d="M3.5 14V2.5" /><path d="M3.5 3h8l-1.8 3 1.8 3h-8" /></>,
  sparkle: <><path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l1.8 1.8M10.2 10.2 12 12M12 4l-1.8 1.8M5.8 10.2 4 12" /></>,
  swap: <><path d="M3 5h10M10 2l3 3-3 3M13 11H3M6 8l-3 3 3 3" /></>,
  split: <><rect x="2" y="3" width="12" height="10" /><path d="M8 3v10" /></>,
  key: <><circle cx="5" cy="10" r="2.7" /><path d="M7 8.2 13 2.5M11 4.5l1.5 1.5M9.5 6l1.2 1.2" /></>,
  shield: <path d="M8 1.8 13 4v4c0 3-2.2 5.2-5 6.2C5.2 13.2 3 11 3 8V4l5-2.2Z" />,
  lock: <><rect x="3" y="7" width="10" height="7" /><path d="M5 7V5a3 3 0 0 1 6 0v2" /></>,
  box: <><path d="M2 5 8 2l6 3v6l-6 3-6-3Z" /><path d="M2 5l6 3 6-3M8 8v6" /></>,
  satellite: <><path d="m5 11 5-5M9 3l4 4-2 2-4-4 2-2ZM3 9l4 4-2 2-4-4 2-2Z" transform="translate(0.5 -0.5)" /></>,
  refresh: <><path d="M13 3v3.5H9.5" /><path d="M13 6.5A5.5 5.5 0 1 0 13.5 10" /></>,
  graph: <><circle cx="3.5" cy="12" r="1.8" /><circle cx="12.5" cy="12" r="1.8" /><circle cx="8" cy="3.5" r="1.8" /><path d="M4.5 10.5 7 5M11.5 10.5 9 5M5.3 12h5.4" /></>,
  keyboard: <><rect x="1.5" y="4" width="13" height="8" /><path d="M4 6.5h.5M6.5 6.5H7M9 6.5h.5M11.5 6.5h.5M5 9.5h6" /></>,
  eye: <><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" /><circle cx="8" cy="8" r="2" /></>,
  print: <><path d="M4 6V2h8v4M4 11.5H2.5V6h11v5.5H12" /><rect x="4" y="9.5" width="8" height="4.5" /></>,
}

export function Icon({ name, size = 16, className = '', strokeWidth = 1.4 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
      aria-hidden="true"
    >
      {P[name]}
    </svg>
  )
}
