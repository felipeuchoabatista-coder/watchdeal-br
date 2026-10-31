const PATHS: Record<string, string> = {
  tag: 'M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Zm5-5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z',
  watch: 'M9 2h6l1 4a7 7 0 0 1 0 12l-1 4H9l-1-4a7 7 0 0 1 0-12l1-4Zm3 6v4l2.5 1.5',
  ticket: 'M3 7a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-4V7Zm7-2v14',
  bell: 'M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Zm4 11a2 2 0 0 0 4 0',
  pulse: 'M3 12h4l2.5-6 5 12 2.5-6H21',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  back: 'M15 5l-7 7 7 7',
  fire: 'M12 21c4 0 7-2.7 7-6.8 0-3.2-2.1-5.6-3.6-7.2-.3 2-1.3 3.2-2.4 3.6.2-2.9-1-6-3.9-7.6.2 3-1.6 4.9-3 6.6C5.3 11.6 5 13 5 14.2 5 18.3 8 21 12 21Z',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  filter: 'M4 5h16l-6 8v5l-4 2v-7L4 5Z',
  download: 'M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M4 19h16',
  info: 'M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  chat: 'M4 5h16v11H9l-5 4V5Z',
};

export function Icon({ name, size = 20, title }: { name: keyof typeof PATHS; size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      <path d={PATHS[name]} />
    </svg>
  );
}
