const INDIAN_MOBILE_NUMBER = /^[6-9]\d{9}$/;

export function toIndianAuthPhone(phone: string): string | null {
  const normalized = phone.trim();
  if (!INDIAN_MOBILE_NUMBER.test(normalized)) return null;
  return `+91${normalized}`;
}
