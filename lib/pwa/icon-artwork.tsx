export function PwaIconArtwork({ rounded = false }: { rounded?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width="100%"
      height="100%"
      style={{
        borderRadius: rounded ? "22%" : 0,
        overflow: "hidden",
      }}
    >
      <rect width="32" height="32" rx={rounded ? 7 : 0} fill="#0C111D" />
      <rect x="4" y="19" width="5" height="9" rx="1" fill="#3CDDAC" opacity="0.55" />
      <rect x="11" y="12" width="5" height="16" rx="1" fill="#3CDDAC" opacity="0.55" />
      <rect x="18" y="16" width="5" height="12" rx="1" fill="#3CDDAC" opacity="0.55" />
      <rect x="25" y="7" width="5" height="21" rx="1" fill="#3CDDAC" />
      <polyline
        points="3,24 9,18 15,20 21,13 27,9"
        fill="none"
        stroke="#E6EBEF"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="27" cy="9" r="1.6" fill="#E6EBEF" />
    </svg>
  )
}
