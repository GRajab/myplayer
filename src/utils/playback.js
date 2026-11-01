export function parsePlaybackUrl(value, base) {
  const [address, headerText] = value.trim().split('|', 2);
  const parsed = base ? new URL(address, base) : new URL(address);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Unsupported stream URL.');
  const headers = {};
  if (headerText) {
    const allowed = { 'user-agent': 'User-Agent', referer: 'Referer', referrer: 'Referer', origin: 'Origin', cookie: 'Cookie', authorization: 'Authorization' };
    for (const [key, value] of new URLSearchParams(headerText)) {
      const name = allowed[key.toLowerCase()];
      if (name && !/[\r\n]/.test(value)) headers[name] = value;
    }
  }
  return { url: parsed.toString(), headers };
}
export function playbackSource(stream) {
  const parsed = parsePlaybackUrl(stream.url);
  const path = new URL(parsed.url).pathname;
  const contentType = stream.contentType || (/\.m3u8$/i.test(path) ? 'hls' : /\.mpd$/i.test(path) ? 'dash' : 'auto');
  return { uri: parsed.url, contentType, headers: { ...parsed.headers, ...stream.headers } };
}
export function alternateLiveUrl(stream, config) {
  if (stream.category !== 'live' || config?.type !== 'xtream') return null;
  const url = new URL(stream.url);
  if (!/\/live\/[^/]+\/[^/]+\/[^/]+\.(m3u8|ts)$/i.test(url.pathname)) return null;
  url.pathname = url.pathname.replace(/\.(m3u8|ts)$/i, extension => extension.toLowerCase() === '.ts' ? '.m3u8' : '.ts');
  return url.toString();
}
export function playbackFailure(error) {
  const message = error?.message || '';
  const http = message.match(/(?:response(?:\s+code)?|http(?:\/[\d.]+)?|status(?:\s+code)?)[\s:=]*(\d{3})/i)?.[1];
  const code = message.match(/\bERROR_CODE_[A-Z_]+\b/)?.[0];
  if (/cleartext/i.test(message)) return 'HTTP playback blocked. Use HTTPS or an Android development build.';
  if (http === '401' || http === '403' || http === '429') return `Provider refused playback (${http}). Check access or the connection limit.`;
  if (/decod|codec|format.unsupported/i.test(message)) return `This device could not decode the stream.${code ? ' ' + code : ''}`;
  if (/timeout|timed out/i.test(message)) return 'The stream request timed out.';
  if (/ssl|certificate|handshake/i.test(message)) return 'The secure connection to the provider failed.';
  if (/UnknownHost|resolve host|NETWORK_CONNECTION_FAILED/i.test(message)) return 'The provider could not be reached.';
  if (http) return `Stream request failed (${http}).`;
  return code ? `Playback failed (${code}).` : 'Unable to play this stream. Retry or try another channel.';
}
