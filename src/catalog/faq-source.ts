/** Il nome breve del PDF di una FAQ (RIB-44): "qa_op05.pdf" → "OP05", "qa_op14_eb04.pdf" → "OP14 / EB04". */
export function faqSourceLabel(file: string): string {
  const name = file.replace(/^(qa|faq)_/i, '').replace(/\.pdf$/i, '')
  if (/^promotion/i.test(name)) return 'Promo'
  return name.toUpperCase().replaceAll('_', ' / ')
}
