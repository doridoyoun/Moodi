export const notebook = {
  bg: '#f7fafc',
  gridLine: '#e3eef5',
  /** Gallery FAB — 밝은 회색, 파스텔 톤과 조화 */
  fabLight: '#E5E5E5',
  fabLightInk: '#757575',
  ink: '#3d3d3d',
  inkMuted: '#6b7280',
  inkLight: '#9ca3af',
  springGrey: '#c5ccd4',
  cardShadow: 'rgba(15, 23, 42, 0.08)',
};

export const moodPalette = {
  happy: { label: '좋음', bg: '#fff3bf', border: '#f5d76e', ink: '#7a5c00' },
  flutter: { label: '설렘', bg: '#ffd6e8', border: '#f5a3c7', ink: '#8b2252' },
  calm: { label: '잔잔', bg: '#d8f3e0', border: '#9fd4b0', ink: '#1f5c3a' },
  gloom: { label: '가라앉음', bg: '#d6e8ff', border: '#9ec5f7', ink: '#1e3a5f' },
  annoyed: { label: '짜증', bg: '#ffd4cc', border: '#f0a090', ink: '#7a2e1f' },
};

export const moodOrder = ['happy', 'flutter', 'calm', 'gloom', 'annoyed'];

/** Timeline hour-grid cells only — 행복 슬롯만 살짝 더 또렷하게 (하단 FAB·모달은 moodPalette 그대로) */
export const timelineSlotOverrides = {
  happy: { bg: '#FFF8CC', border: '#F4C430' },
};
