export function escapeCSV(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCSV<T extends Record<string, any>>(data: T[], headers?: string[]): string {
  if (data.length === 0) return '';
  const csvHeaders = headers || Object.keys(data[0]);
  const headerRow = csvHeaders.map(escapeCSV).join(',');
  const dataRows = data.map((row) => csvHeaders.map((h) => escapeCSV(row[h])).join(','));
  return [headerRow, ...dataRows].join('\n');
}
