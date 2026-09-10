/**
 * Shared helpers for turning messy scraped strings into a consistent shape.
 */

/**
 * Parse a price out of arbitrary text like "AED 12.50", "Dhs. 12,50", "12.5 د.إ".
 * @returns {number | null} numeric value in AED, or null if nothing usable.
 */
export function parsePrice(input) {
  if (input == null) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;

  const text = String(input);
  // Grab the first number-ish token (handles thousands sep + decimal).
  const match = text.match(/(\d[\d,.\s]*\d|\d)/);
  if (!match) return null;

  let raw = match[1].replace(/\s/g, '');
  // If both separators present, assume the last one is the decimal separator.
  if (raw.includes(',') && raw.includes('.')) {
    if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) {
      raw = raw.replace(/\./g, '').replace(',', '.');
    } else {
      raw = raw.replace(/,/g, '');
    }
  } else if (raw.includes(',')) {
    // Lone comma: decimal if it looks like "12,50", else thousands.
    raw = /,\d{2}$/.test(raw) ? raw.replace(',', '.') : raw.replace(/,/g, '');
  }

  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
}

export function cleanText(input) {
  if (input == null) return null;
  const t = String(input).replace(/\s+/g, ' ').trim();
  return t || null;
}

export function absoluteUrl(href, base) {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

/**
 * Build the canonical product object every scraper returns.
 */
export function makeProduct(input) {
  const { name, price, image, url, unit, brand } = input || {};
  const priceValue = parsePrice(price);
  return {
    name: cleanText(name),
    brand: cleanText(brand),
    price: priceValue,
    priceFormatted: priceValue != null ? `AED ${priceValue.toFixed(2)}` : null,
    currency: 'AED',
    image: image || null,
    url: url || null,
    unit: cleanText(unit),
  };
}

/**
 * Standard result card returned to the frontend for one retailer.
 * status: 'ok' | 'no_results' | 'unavailable'
 */
export function makeCard(retailer, patch = {}) {
  return {
    retailer: retailer.id,
    retailerName: retailer.name,
    retailerColor: retailer.color,
    homepage: retailer.homepage,
    status: 'unavailable',
    product: null,
    message: null,
    cached: false,
    fetchedAt: new Date().toISOString(),
    ...patch,
  };
}
