// pretty-print a /search response from stdin
let d = '';
process.stdin.on('data', (c) => (d += c)).on('end', () => {
  const j = JSON.parse(d);
  console.log(`query: "${j.query}"   cheapest: ${j.cheapest || '(none)'}   ${j.generatedAt || ''}`);
  for (const r of j.results) {
    const p = r.product;
    const info = p
      ? `${(p.priceFormatted || '?').padEnd(11)} ${(p.name || '').slice(0, 58)}`
      : r.message || '';
    console.log(
      `  ${r.retailer.padEnd(10)} ${String(r.status).padEnd(12)} ${String(r.tookMs ?? '').padStart(6)}ms  ${info}`
    );
  }
});
