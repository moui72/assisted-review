interface UADataLike {
  platform?: string;
}

export function detectMac(nav: Navigator = navigator): boolean {
  const uaData = (nav as Navigator & { userAgentData?: UADataLike }).userAgentData;
  if (uaData?.platform) return /mac/i.test(uaData.platform);
  return /mac|iphone|ipad/i.test(nav.userAgent);
}
