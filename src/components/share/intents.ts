/** Social share intent URLs (no SDKs, no tracking). */

export interface ShareTarget {
  url: string;
  text: string;
  hashtags?: string[];
}

const enc = encodeURIComponent;

export function xIntent({ url, text, hashtags }: ShareTarget): string {
  const tags = hashtags?.length ? `&hashtags=${enc(hashtags.join(','))}` : '';
  return `https://x.com/intent/tweet?text=${enc(text)}&url=${enc(url)}${tags}`;
}

export function threadsIntent({ url, text }: ShareTarget): string {
  return `https://www.threads.net/intent/post?text=${enc(`${text}\n${url}`)}`;
}

export function facebookIntent({ url }: ShareTarget): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`;
}

export function lineIntent({ url, text }: ShareTarget): string {
  return `https://social-plugins.line.me/lineit/share?url=${enc(url)}&text=${enc(text)}`;
}

export function openShareWindow(href: string): void {
  const w = 620;
  const h = 640;
  const left = Math.max(0, (window.screen.width - w) / 2);
  const top = Math.max(0, (window.screen.height - h) / 2);
  const win = window.open(href, '_blank', `noopener,noreferrer,width=${w},height=${h},left=${left},top=${top}`);
  if (!win) window.location.href = href;
}
